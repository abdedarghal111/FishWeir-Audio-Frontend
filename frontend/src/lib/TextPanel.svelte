<script module lang="ts">
    // Persistente: no se reinicia al cambiar de pestaña.
    let ttsLoading = $state(false)
    let ttsError = $state('')
    let audioUrl = $state('')
    // Id que asigna el backend a esta generación, mandado en una cabecera (la respuesta de
    // /api/tts es audio, no JSON); se usa para nombrar la descarga igual que en Historial.
    let audioId = $state('')
    let audioTime = $state(0)
    let audioDuration = $state(0)
    let audioVolume = $state(1)
    let audioPaused = $state(true)

    // Snapshot del texto justo antes de aceptar un resultado de la IA, para
    // poder deshacerlo con un click si el resultado no gusta.
    let previousText: string | null = $state(null)

    // "Mejorar con IA" solo se muestra si el backend tiene DeepSeek configurado (solo se comprueba que exista la key).
    let enhanceAvailable = $state(false)
    fetch('/api/enhance-text/status')
        .then((res) => (res.ok ? res.json() : { available: false }))
        .then((data) => (enhanceAvailable = Boolean(data?.available)))
        .catch(() => {})
</script>

<script lang="ts">
    // Pestaña "Generar": texto/modelo + selector compacto de voz (VoiceQuickPicker) en el mismo formulario.
    import { MODELS, errorMessage, loadPersisted, savePersisted, type Favorite, type Voice } from './types'
    import AudioPlayer from './AudioPlayer.svelte'
    import EnhanceTextModal from './EnhanceTextModal.svelte'
    import GeneratingIndicator from './GeneratingIndicator.svelte'
    import { playNotifySound } from './notifySound'
    import VoiceQuickPicker from './VoiceQuickPicker.svelte'

    let {
        voices,
        sharedVoices,
        favorites,
        fishAvailable,
        referenceId = $bindable(''),
        isFavorite,
        onToggleFavorite,
        onGenerated,
        onError,
    }: {
        voices: Voice[]
        sharedVoices: Voice[]
        favorites: Favorite[]
        // Si es `false`, falta FISH_API_KEY: se deshabilita "Generar audio" en vez de fallar.
        fishAvailable: boolean
        referenceId: string
        isFavorite: (type: Favorite['type'], id: string) => boolean
        onToggleFavorite: (type: Favorite['type'], id: string, label: string) => void
        onGenerated: () => void
        // Además de ttsError aquí, avisa con un toast global en App.svelte por si cambia de pestaña.
        onError: (message: string) => void
    } = $props()

    // El formulario (texto, modelo, params avanzados) se recuerda entre visitas (localStorage),
    // igual que referenceId (que vive en App.svelte).
    let text = $state(loadPersisted('text', ''))
    $effect(() => savePersisted('text', text))

    let showEnhanceModal = $state(false)

    function acceptEnhancedText(newText: string) {
        previousText = text
        text = newText
        showEnhanceModal = false
    }

    function undoEnhancedText() {
        if (previousText === null) return
        text = previousText
        previousText = null
    }

    let model = $state(loadPersisted('model', 's2.1-pro-free'))
    $effect(() => savePersisted('model', model))

    let autoplay = $state(loadPersisted('autoplay', true))
    $effect(() => savePersisted('autoplay', autoplay))

    let notifySound = $state(loadPersisted('notifySound', true))
    $effect(() => savePersisted('notifySound', notifySound))

    const AUTOPLAY_DELAY_MS = 250

    // Parámetros avanzados (ver docs/emociones-y-tono-fish-audio.md §5), con los valores
    // por defecto de la propia API de Fish Audio; se guardan aparte para el botón de reset.
    const DEFAULTS = {
        speed: 1,
        volume: 0,
        temperature: 0.7,
        topP: 0.7,
        chunkLength: 200,
        normalize: true,
        latency: 'balanced' as const,
        sampleRate: '',
    }

    let speed = $state(loadPersisted('speed', 1))
    $effect(() => savePersisted('speed', speed))

    let volume = $state(loadPersisted('volume', 0))
    $effect(() => savePersisted('volume', volume))

    let temperature = $state(loadPersisted('temperature', 0.7))
    $effect(() => savePersisted('temperature', temperature))

    let topP = $state(loadPersisted('topP', 0.7))
    $effect(() => savePersisted('topP', topP))

    let chunkLength = $state(loadPersisted('chunkLength', 200))
    $effect(() => savePersisted('chunkLength', chunkLength))

    let normalize = $state(loadPersisted('normalize', true))
    $effect(() => savePersisted('normalize', normalize))

    let latency = $state(loadPersisted<'normal' | 'balanced'>('latency', 'balanced'))
    $effect(() => savePersisted('latency', latency))

    // Cadena vacía = no forzar sample rate (se usa el de por defecto del modelo).
    let sampleRate = $state(loadPersisted('sampleRate', ''))
    $effect(() => savePersisted('sampleRate', sampleRate))

    let allVoices = $derived([...voices, ...sharedVoices])
    let selectedVoice = $derived(allVoices.find((v) => v.id === referenceId))

    let showVoiceModal = $state(false)

    function closeVoiceModalOnEscape(e: KeyboardEvent) {
        if (e.key === 'Escape' && showVoiceModal) showVoiceModal = false
    }

    function selectFavorite(fav: Favorite) {
        if (fav.type === 'model') model = fav.id
        else referenceId = fav.id
    }

    async function generateSpeech(e: Event) {
        e.preventDefault()
        if (!text.trim() || !fishAvailable) return

        ttsLoading = true
        ttsError = ''
        try {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    model,
                    referenceId: referenceId || undefined,
                    voiceTitle: selectedVoice?.title,
                    speed,
                    volume,
                    temperature,
                    topP,
                    chunkLength,
                    normalize,
                    latency,
                    sampleRate: sampleRate ? Number(sampleRate) : undefined,
                }),
            })
            if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))

            if (audioUrl) URL.revokeObjectURL(audioUrl)
            audioId = res.headers.get('X-Generation-Id') ?? ''
            audioUrl = URL.createObjectURL(await res.blob())
            audioTime = 0
            audioDuration = 0
            // Los switches se consultan aquí, ya confirmada la generación, y no antes.
            audioPaused = true
            if (notifySound) {
                playNotifySound()
            }
            if (autoplay) {
                // Solapados, la campanada y el principio del texto se pisan.
                if (notifySound) {
                    setTimeout(() => (audioPaused = false), AUTOPLAY_DELAY_MS)
                } else {
                    audioPaused = false
                }
            }
            // El backend ya lo ha guardado (audio + texto/modelo/voz) en su historial.
            onGenerated()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error generando el audio'
            ttsError = message
            onError(message)
        } finally {
            ttsLoading = false
        }
    }
</script>

{#if favorites.length > 0}
    <section class="card mb-4">
        <div class="card-body">
            <h3 class="h6 card-title mb-2"><i class="fa-solid fa-star" aria-hidden="true"></i> Favoritos</h3>
            <div class="d-flex flex-wrap gap-2">
                {#each favorites as fav (fav.key)}
                    <div class="btn-group" role="group">
                        <button
                            type="button"
                            class="btn btn-sm"
                            class:btn-primary={(fav.type === 'model' && model === fav.id) || (fav.type === 'voice' && referenceId === fav.id)}
                            class:btn-outline-primary={!((fav.type === 'model' && model === fav.id) || (fav.type === 'voice' && referenceId === fav.id))}
                            onclick={() => selectFavorite(fav)}
                        >
                            <i class="fa-solid {fav.type === 'model' ? 'fa-robot' : 'fa-microphone'}" aria-hidden="true"></i> {fav.label}
                        </button>
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-secondary"
                            title="Quitar de favoritos"
                            onclick={() => onToggleFavorite(fav.type, fav.id, fav.label)}
                        >
                            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                        </button>
                    </div>
                {/each}
            </div>
        </div>
    </section>
{/if}

{#if !fishAvailable}
    <div class="alert alert-warning d-flex align-items-start gap-2">
        <i class="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true"></i>
        <span>
            No se puede generar audio: falta configurar la API key de Fish Audio en el servidor
            (<code>FISH_API_KEY</code> en <code>.env</code>). El resto de la aplicación funciona con normalidad.
        </span>
    </div>
{/if}

<form onsubmit={generateSpeech} class="d-flex flex-column gap-4">
    <div class="row g-3 align-items-end">
        <div class="col-md-6">
            <label class="form-label" for="model">Modelo</label>
            <div class="d-flex gap-2">
                <select id="model" class="form-select" bind:value={model}>
                    {#each MODELS as m (m.value)}
                        <option value={m.value}>{m.label}</option>
                    {/each}
                </select>
                <button
                    type="button"
                    class="btn btn-outline-secondary flex-shrink-0"
                    title={isFavorite('model', model) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                    onclick={() => onToggleFavorite('model', model, MODELS.find((m) => m.value === model)?.label ?? model)}
                >
                    <i class="fa-{isFavorite('model', model) ? 'solid' : 'regular'} fa-star" aria-hidden="true"></i>
                </button>
            </div>
        </div>

        <div class="col-md-6">
            <span class="form-label d-block">Voz clonada</span>
            <button
                type="button"
                class="btn btn-outline-secondary w-100 text-start d-flex align-items-center gap-2"
                onclick={() => (showVoiceModal = true)}
            >
                {#if selectedVoice?.coverImage}
                    <img src={selectedVoice.coverImage} alt="" class="rounded object-fit-cover flex-shrink-0" style="width: 1.75rem; height: 1.75rem;" />
                {/if}
                <span class="text-truncate"><i class="fa-solid fa-microphone" aria-hidden="true"></i> {selectedVoice ? selectedVoice.title : 'Voz por defecto del modelo (elegir...)'}</span>
            </button>
        </div>
    </div>

    <div class="d-flex align-items-center flex-wrap gap-3">
        <div class="form-check form-switch mb-0">
            <input id="autoplay" class="form-check-input" type="checkbox" role="switch" bind:checked={autoplay} />
            <label class="form-check-label small" for="autoplay">
                <i class="fa-solid fa-circle-play" aria-hidden="true"></i> Reproducir al terminar
            </label>
        </div>

        <div class="form-check form-switch mb-0">
            <!-- Se mira `currentTarget.checked` porque el binding aún puede ir un paso por detrás. -->
            <input
                id="notifySound"
                class="form-check-input"
                type="checkbox"
                role="switch"
                bind:checked={notifySound}
                onchange={(e) => e.currentTarget.checked && playNotifySound()}
            />
            <label class="form-check-label small" for="notifySound">
                <i class="fa-solid fa-bell" aria-hidden="true"></i> Sonido de aviso
            </label>
        </div>

        <button
            type="submit"
            class="btn btn-primary ms-auto flex-shrink-0"
            disabled={ttsLoading || !fishAvailable}
            title={fishAvailable ? '' : 'Falta configurar FISH_API_KEY en .env'}
        >
            {#if ttsLoading}<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>{/if}
            {ttsLoading ? 'Generando...' : 'Generar audio'}
        </button>
    </div>

    {#if ttsError}<div class="alert alert-danger py-2 mb-0">{ttsError}</div>{/if}
    {#if ttsLoading}
        <GeneratingIndicator />
    {:else if audioUrl}
        <!-- Sin la key el reproductor conservaría el estado del audio anterior. -->
        {#key audioUrl}
            <AudioPlayer
                src={audioUrl}
                downloadName="{audioId || 'fish-audio'}.wav"
                compressedName="{audioId || 'fish-audio'}.mp3"
                bind:currentTime={audioTime}
                bind:duration={audioDuration}
                bind:volume={audioVolume}
                bind:paused={audioPaused}
            />
        {/key}
    {/if}

    <div>
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
            <label class="form-label mb-0" for="text">Texto</label>
            <div class="d-flex align-items-center gap-2">
                {#if previousText !== null}
                    <button type="button" class="btn btn-sm btn-link text-decoration-none p-0" onclick={undoEnhancedText}>
                        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Deshacer
                    </button>
                {/if}
                {#if enhanceAvailable}
                    <button type="button" class="btn btn-sm btn-outline-primary" onclick={() => (showEnhanceModal = true)} disabled={!text.trim()}>
                        <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Mejorar con IA
                    </button>
                {/if}
            </div>
        </div>
        <textarea
            id="text"
            class="form-control"
            bind:value={text}
            rows="8"
            placeholder="Escribe el texto a convertir en audio..."
            required
        ></textarea>
        <p class="form-text mb-0">
            <i class="fa-solid fa-lightbulb" aria-hidden="true"></i> Con <code>s2.1-pro</code> puedes marcar emoción y tono escribiendo instrucciones libres entre corchetes
            dentro del texto, por ejemplo <code>[happy]</code>, <code>[whispering]</code> o <code>[muy triste]</code> —
            colócalas al principio de la frase que quieras afectar. Más detalle en
            <code>docs/emociones-y-tono-fish-audio.md</code>.
        </p>
    </div>

    <div>
        <h3 class="h6 mb-2">Opciones avanzadas</h3>
        <div class="row g-2">
            <div class="col-6 col-md-4 col-lg-3">
                <div class="d-flex justify-content-between align-items-center">
                    <label class="form-label small mb-1" for="speed">Velocidad ({speed.toFixed(1)}×)</label>
                    <button type="button" class="btn-reset" title="Restablecer" onclick={() => (speed = DEFAULTS.speed)}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
                </div>
                <input id="speed" type="range" class="form-range slider-compact" min="0.5" max="2" step="0.1" bind:value={speed} />
                <p class="advanced-hint">Multiplica la velocidad de habla: 0.5× más lento, 2× más rápido.</p>
            </div>

            <div class="col-6 col-md-4 col-lg-3">
                <div class="d-flex justify-content-between align-items-center">
                    <label class="form-label small mb-1" for="volume">Volumen ({volume} dB)</label>
                    <button type="button" class="btn-reset" title="Restablecer" onclick={() => (volume = DEFAULTS.volume)}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
                </div>
                <input id="volume" type="range" class="form-range slider-compact" min="-20" max="20" step="1" bind:value={volume} />
                <p class="advanced-hint">Sube o baja el volumen, en dB (de -20 a +20).</p>
            </div>

            <div class="col-6 col-md-4 col-lg-3">
                <div class="d-flex justify-content-between align-items-center">
                    <label class="form-label small mb-1" for="temperature">Temperature ({temperature.toFixed(2)})</label>
                    <button type="button" class="btn-reset" title="Restablecer" onclick={() => (temperature = DEFAULTS.temperature)}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
                </div>
                <input id="temperature" type="range" class="form-range slider-compact" min="0" max="1" step="0.05" bind:value={temperature} />
                <p class="advanced-hint">Más bajo = voz más estable, más alto = más expresiva.</p>
            </div>

            <div class="col-6 col-md-4 col-lg-3">
                <div class="d-flex justify-content-between align-items-center">
                    <label class="form-label small mb-1" for="topP">Top P ({topP.toFixed(2)})</label>
                    <button type="button" class="btn-reset" title="Restablecer" onclick={() => (topP = DEFAULTS.topP)}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
                </div>
                <input id="topP" type="range" class="form-range slider-compact" min="0" max="1" step="0.05" bind:value={topP} />
                <p class="advanced-hint">Diversidad del muestreo; junto a temperature controla cuánto varía la voz.</p>
            </div>

            <div class="col-6 col-md-4 col-lg-3">
                <div class="d-flex justify-content-between align-items-center">
                    <label class="form-label small mb-1" for="chunkLength">Chunk length ({chunkLength})</label>
                    <button type="button" class="btn-reset" title="Restablecer" onclick={() => (chunkLength = DEFAULTS.chunkLength)}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
                </div>
                <input id="chunkLength" type="range" class="form-range slider-compact" min="100" max="300" step="10" bind:value={chunkLength} />
                <p class="advanced-hint">Texto agrupado antes de sintetizar: más bajo suena antes, más alto mejora la coherencia en textos largos.</p>
            </div>

            <div class="col-6 col-md-4 col-lg-3">
                <div class="d-flex justify-content-between align-items-center">
                    <label class="form-label small mb-1" for="latency">Latencia</label>
                    <button type="button" class="btn-reset" title="Restablecer" onclick={() => (latency = DEFAULTS.latency)}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
                </div>
                <select id="latency" class="form-select form-select-sm" bind:value={latency}>
                    <option value="balanced">Balanceada (recomendado)</option>
                    <option value="normal">Normal (más estable)</option>
                </select>
                <p class="advanced-hint">Balanceada prioriza empezar a sonar antes; normal prioriza estabilidad.</p>
            </div>

            <div class="col-6 col-md-4 col-lg-3">
                <div class="d-flex justify-content-between align-items-center">
                    <label class="form-label small mb-1" for="sampleRate">Sample rate (Hz)</label>
                    <button type="button" class="btn-reset" title="Restablecer" onclick={() => (sampleRate = DEFAULTS.sampleRate)}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
                </div>
                <input id="sampleRate" type="number" class="form-control form-control-sm" placeholder="por defecto" bind:value={sampleRate} />
                <p class="advanced-hint">Fuerza una frecuencia de muestreo; vacío usa la del modelo.</p>
            </div>

            <div class="col-6 col-md-4 col-lg-3">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="form-label small mb-1">Normalizar</span>
                    <button type="button" class="btn-reset" title="Restablecer" onclick={() => (normalize = DEFAULTS.normalize)}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
                </div>
                <div class="form-check">
                    <input id="normalize" type="checkbox" class="form-check-input" bind:checked={normalize} />
                    <label class="form-check-label small" for="normalize">Números/fechas</label>
                </div>
                <p class="advanced-hint">Lee números y fechas de forma natural (p. ej. "3" → "tres").</p>
            </div>
        </div>
    </div>

</form>

<svelte:window onkeydown={closeVoiceModalOnEscape} />

{#if showVoiceModal}
    <!-- El backdrop cierra al hacer click; Escape (svelte:window arriba) cubre el teclado. -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="modal d-block"
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-label="Elegir voz clonada"
        style="background: rgba(0, 0, 0, 0.5);"
        onclick={() => (showVoiceModal = false)}
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="modal-dialog modal-lg" onclick={(e) => e.stopPropagation()}>
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Elegir voz clonada</h5>
                    <button type="button" class="btn-close" aria-label="Cerrar" onclick={() => (showVoiceModal = false)}></button>
                </div>
                <div class="modal-body">
                    <VoiceQuickPicker {voices} {sharedVoices} bind:referenceId onSelect={() => (showVoiceModal = false)} />
                </div>
            </div>
        </div>
    </div>
{/if}

{#if showEnhanceModal}
    <EnhanceTextModal {text} {model} onAccept={acceptEnhancedText} onClose={() => (showEnhanceModal = false)} />
{/if}

<style>
    /* Sliders más finos que el default de Bootstrap. WebKit no autocentra el thumb
       sobre el track: margin-top negativo = (alto track - alto thumb) / 2. */
    .slider-compact {
        height: 0.75rem;
    }
    .slider-compact::-webkit-slider-runnable-track {
        height: 0.3rem;
    }
    .slider-compact::-webkit-slider-thumb {
        width: 0.65rem;
        height: 0.65rem;
        margin-top: -0.175rem;
    }
    .slider-compact::-moz-range-track {
        height: 0.3rem;
    }
    .slider-compact::-moz-range-thumb {
        width: 0.65rem;
        height: 0.65rem;
    }

    /* Botón de resetear cada parámetro: pequeño pero con forma de botón real
       (borde), no un link subrayado. */
    .btn-reset {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.3rem;
        height: 1.3rem;
        padding: 0;
        line-height: 1;
        font-size: 0.75rem;
        border: 1px solid var(--bs-border-color);
        border-radius: var(--bs-border-radius-sm);
        background: transparent;
        color: var(--bs-secondary-color);
    }
    .btn-reset:hover {
        background: var(--bs-secondary-bg);
    }

    /* Footer de cada parámetro avanzado: más pequeño que .form-text para que
       toda la sección quepa en menos espacio. */
    .advanced-hint {
        font-size: 0.72rem;
        line-height: 1.2;
        color: var(--bs-secondary-color);
        margin: 0.2rem 0 0;
    }
</style>
