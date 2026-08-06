<script lang="ts">
  // Pestaña "Generar": el texto/modelo y, dentro del mismo formulario, la
  // lista compacta para elegir la voz clonada (VoiceQuickPicker) — así el
  // envío usa directamente lo que haya en referenceId al generar.
  import { MODELS, errorMessage, loadPersisted, savePersisted, type Favorite, type Voice } from './types'
  import AudioPlayer from './AudioPlayer.svelte'
  import VoiceQuickPicker from './VoiceQuickPicker.svelte'

  let {
    voices,
    sharedVoices,
    favorites,
    referenceId = $bindable(''),
    isFavorite,
    onToggleFavorite,
    onGenerated,
    onError,
  }: {
    voices: Voice[]
    sharedVoices: Voice[]
    favorites: Favorite[]
    referenceId: string
    isFavorite: (type: Favorite['type'], id: string) => boolean
    onToggleFavorite: (type: Favorite['type'], id: string, label: string) => void
    onGenerated: () => void
    // Además del error que se muestra aquí mismo (ttsError), se avisa también
    // arriba en App.svelte con un toast global — así no se pierde si el
    // usuario cambia de pestaña mientras se genera el audio.
    onError: (message: string) => void
  } = $props()

  // Todo el formulario (texto, modelo y parámetros avanzados) se recuerda
  // entre visitas (localStorage), igual que la voz clonada (referenceId, que
  // vive en App.svelte), para no perderlo si se recarga la página o se
  // cambia de pestaña.
  let text = $state(loadPersisted('text', ''))
  $effect(() => savePersisted('text', text))

  let model = $state(loadPersisted('model', 's2.1-pro-free'))
  $effect(() => savePersisted('model', model))

  // Parámetros avanzados de generación (ver docs/emociones-y-tono-fish-audio.md
  // §5). Los valores por defecto coinciden con los que usa la propia API de
  // Fish Audio, así que no cambian nada mientras no se toquen. Se guardan
  // aparte para que el botón de reset de cada control vuelva justo a esto.
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

  let ttsLoading = $state(false)
  let ttsError = $state('')
  let audioUrl = $state('')
  // Id que el backend asigna a esta generación en su historial (lo manda en
  // una cabecera porque la respuesta de /api/tts es el audio en crudo, no
  // JSON) — se usa para que el nombre de descarga coincida con el que se ve
  // luego en la pestaña de Historial, en vez de un nombre genérico.
  let audioId = $state('')

  async function generateSpeech(e: Event) {
    e.preventDefault()
    if (!text.trim()) return

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

<form onsubmit={generateSpeech} class="d-flex flex-column gap-4">
  <div class="row g-3 align-items-end">
    <div class="col-md-5">
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

    <div class="col-md-5">
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

    <div class="col-md-2">
      <button type="submit" class="btn btn-primary w-100" disabled={ttsLoading}>
        {#if ttsLoading}<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>{/if}
        {ttsLoading ? 'Generando...' : 'Generar audio'}
      </button>
    </div>
  </div>

  {#if ttsError}<div class="alert alert-danger py-2 mb-0">{ttsError}</div>{/if}
  {#if audioUrl}<AudioPlayer src={audioUrl} downloadName="{audioId || 'fish-audio'}.wav" compressedName="{audioId || 'fish-audio'}.mp3" />{/if}

  <div>
    <label class="form-label" for="text">Texto</label>
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
  <!-- El fondo del modal cierra al hacer click fuera; Escape lo cierra igual
     (svelte:window de arriba), así que el propio backdrop no necesita ser
     un elemento interactivo por teclado. -->
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

<style>
  /* Sliders más finos que el tamaño por defecto de Bootstrap. En WebKit el
     thumb no se autocentra sobre el track como en Firefox: hay que subirlo
     con margin-top = (alto del track - alto del thumb) / 2 (negativo, porque
     el thumb es más alto que el track) o queda pegado al borde superior. */
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
