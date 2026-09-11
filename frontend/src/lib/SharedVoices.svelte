<script module lang="ts">
  // Persistente: no se reinicia al cambiar de pestaña.
  let sharedVoiceInput = $state('')
  let sharedVoiceLoading = $state(false)
  let sharedVoiceError = $state('')
  let sharedVoiceSearch = $state('')
</script>

<script lang="ts">
  // Pestaña "Voces compartidas": voces de otros autores guardadas por enlace o ID.
  import type { Favorite, Voice } from './types'
  import VoiceCard from './VoiceCard.svelte'

  let {
    sharedVoices,
    favorites,
    fishAvailable,
    referenceId = $bindable(''),
    isFavorite,
    onToggleFavorite,
    onAddSharedVoice,
    onRemoveSharedVoice,
  }: {
    sharedVoices: Voice[]
    favorites: Favorite[]
    // Si es `false`, falta FISH_API_KEY: no se pueden añadir voces nuevas, pero las
    // ya guardadas se siguen listando y quitando igual.
    fishAvailable: boolean
    referenceId: string
    isFavorite: (type: Favorite['type'], id: string) => boolean
    onToggleFavorite: (type: Favorite['type'], id: string, label: string) => void
    onAddSharedVoice: (input: string) => Promise<void>
    onRemoveSharedVoice: (id: string) => Promise<void>
  } = $props()

  async function addSharedVoice(e: Event) {
    e.preventDefault()
    if (!sharedVoiceInput.trim() || !fishAvailable) return

    sharedVoiceLoading = true
    sharedVoiceError = ''
    try {
      await onAddSharedVoice(sharedVoiceInput)
      sharedVoiceInput = ''
    } catch (err) {
      sharedVoiceError = err instanceof Error ? err.message : 'Error añadiendo la voz'
    } finally {
      sharedVoiceLoading = false
    }
  }

  async function removeSharedVoice(id: string) {
    try {
      await onRemoveSharedVoice(id)
    } catch {
      // Error no crítico: se ignora para no bloquear la interfaz.
    }
  }

  let filteredSharedVoices = $derived(
    sharedVoices.filter((v) => v.title.toLowerCase().includes(sharedVoiceSearch.trim().toLowerCase())),
  )
</script>

<h2 class="h5 mb-3">Voces compartidas</h2>

<section class="mb-4">
  <h3 class="h6">Añadir voz compartida</h3>
  <p class="text-body-secondary small">
    Pega aquí el enlace de una voz de fish.audio (el que se ve en la barra de direcciones al abrirla, tipo
    <code>https://fish.audio/m/&lt;id&gt;</code>) o directamente su ID, y quedará guardada en este servidor para poder
    usarla al generar audio, aunque no sea tuya.
  </p>
  <form onsubmit={addSharedVoice} class="d-flex gap-2">
    <input
      type="text"
      class="form-control"
      bind:value={sharedVoiceInput}
      placeholder="https://fish.audio/m/... o ID de la voz"
      disabled={!fishAvailable}
      required
    />
    <button
      type="submit"
      class="btn btn-primary flex-shrink-0"
      disabled={sharedVoiceLoading || !sharedVoiceInput.trim() || !fishAvailable}
      title={fishAvailable ? '' : 'Falta configurar FISH_API_KEY en .env'}
    >
      {#if sharedVoiceLoading}<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>{/if}
      {sharedVoiceLoading ? 'Añadiendo...' : 'Añadir'}
    </button>
  </form>
  {#if !fishAvailable}
    <div class="alert alert-warning d-flex align-items-start gap-2 mt-3 mb-0">
      <i class="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true"></i>
      <span>
        No se pueden añadir voces compartidas nuevas: falta configurar la API key de Fish Audio en el servidor
        (<code>FISH_API_KEY</code> en <code>.env</code>). Puedes seguir usando las que ya tengas guardadas.
      </span>
    </div>
  {:else if sharedVoiceError}
    <div class="alert alert-danger py-2 mt-3 mb-0">{sharedVoiceError}</div>
  {/if}
</section>

<section class="mb-4">
  <h3 class="h6">Filtrar</h3>
  <input
    type="search"
    class="form-control form-control-sm"
    bind:value={sharedVoiceSearch}
    placeholder="Buscar por título..."
  />
</section>

<section>
  <h3 class="h6">Voces guardadas</h3>
  {#if sharedVoices.length === 0}
    <p class="text-body-secondary">Todavía no has guardado ninguna voz compartida.</p>
  {:else if filteredSharedVoices.length === 0}
    <p class="text-body-secondary">Ninguna voz compartida coincide con "{sharedVoiceSearch}".</p>
  {:else}
    <div class="d-flex flex-column gap-3">
      {#each filteredSharedVoices as voice (voice.id)}
        <VoiceCard
          {voice}
          favorite={isFavorite('voice', voice.id)}
          onToggleFavorite={() => onToggleFavorite('voice', voice.id, voice.title)}
          onSelect={() => (referenceId = voice.id)}
          selected={referenceId === voice.id}
          onRemove={() => removeSharedVoice(voice.id)}
          removeLabel="Quitar"
        />
      {/each}
    </div>
  {/if}
</section>
