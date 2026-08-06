<script lang="ts">
  // Pestaña "Generar": el texto/modelo y, dentro del mismo formulario, la
  // lista compacta para elegir la voz clonada (VoiceQuickPicker) — así el
  // envío usa directamente lo que haya en referenceId al generar.
  import { MODELS, errorMessage, loadPersisted, savePersisted, type Favorite, type Voice } from './types'
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

  let text = $state('')

  // El modelo elegido se recuerda entre visitas (localStorage), igual que la
  // voz clonada (referenceId, que vive en App.svelte).
  let model = $state(loadPersisted('model', 's2.1-pro-free'))
  $effect(() => savePersisted('model', model))

  let allVoices = $derived([...voices, ...sharedVoices])
  let selectedVoice = $derived(allVoices.find((v) => v.id === referenceId))

  function selectFavorite(fav: Favorite) {
    if (fav.type === 'model') model = fav.id
    else referenceId = fav.id
  }

  let ttsLoading = $state(false)
  let ttsError = $state('')
  let audioUrl = $state('')

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
        }),
      })
      if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))

      if (audioUrl) URL.revokeObjectURL(audioUrl)
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

<form onsubmit={generateSpeech} class="row g-4">
  <div class="col-lg-7 d-flex flex-column gap-3">
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
    </div>

    <div>
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

    <p class="text-body-secondary small mb-0">
      Voz clonada: {selectedVoice ? selectedVoice.title : 'ninguna (se usará la voz por defecto del modelo)'}
    </p>

    <button type="submit" class="btn btn-primary align-self-start" disabled={ttsLoading}>
      {#if ttsLoading}<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>{/if}
      {ttsLoading ? 'Generando...' : 'Generar audio'}
    </button>

    {#if ttsError}<div class="alert alert-danger py-2 mb-0">{ttsError}</div>{/if}
    {#if audioUrl}<audio controls src={audioUrl} class="w-100"></audio>{/if}
  </div>

  <div class="col-lg-5 border-start-lg ps-lg-4">
    <VoiceQuickPicker {voices} {sharedVoices} bind:referenceId />
  </div>
</form>

<style>
  /* Bootstrap no tiene un modificador "border-start" solo a partir de lg;
     lo añadimos aquí para separar visualmente las dos columnas en pantallas
     anchas, sin que se note el borde cuando se apilan en móvil. */
  @media (min-width: 992px) {
    .border-start-lg {
      border-left: 1px solid var(--bs-border-color);
    }
  }
</style>
