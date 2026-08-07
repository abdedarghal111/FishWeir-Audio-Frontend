<script lang="ts">
  // Componente raíz: solo la capa de datos (llamadas al backend con fetch) y
  // las pestañas. La UI en sí vive en frontend/src/lib/*.svelte:
  // - TextPanel: pestaña "Generar" — el texto/modelo (izquierda) y, dentro
  //   del mismo formulario, la lista compacta (foto + nombre, con filtro)
  //   para elegir rápido la voz clonada (derecha, vía VoiceQuickPicker).
  // - MyVoices: pestaña "Mis voces" — clonar una voz nueva y la lista de
  //   las que ya tienes, con todos sus datos y acciones.
  // - SharedVoices: pestaña "Voces compartidas" — añadir por enlace/ID,
  //   filtrar y la lista de las guardadas.
  // - GenerationHistory: pestaña "Historial" — todos los audios generados.
  //
  // referenceId (la voz clonada elegida) se puede fijar desde varias
  // pestañas, así que vive aquí y viaja a todas. Cada vez que TextPanel
  // genera un audio nuevo, avisa con onGenerated para refrescar el historial.
  import GenerationHistory from './lib/GenerationHistory.svelte'
  import MyVoices from './lib/MyVoices.svelte'
  import SharedVoices from './lib/SharedVoices.svelte'
  import TextPanel from './lib/TextPanel.svelte'
  import { errorMessage, loadPersisted, savePersisted, type Favorite, type Generation, type Voice } from './lib/types'

  let tab: 'generar' | 'mis-voces' | 'compartidas' | 'historial' = $state('generar')

  // Cada formulario ya muestra su propio error junto a sí mismo, pero esa
  // alerta vive en el estado del componente: si el usuario cambia de pestaña
  // antes de que termine una petición larga (p. ej. subir un audio de varios
  // minutos para clonar una voz), el componente se desmonta y el aviso se
  // pierde sin que nadie lo vea. Este toast vive aquí arriba, en App.svelte,
  // así que sobrevive al cambio de pestaña y siempre es visible.
  let toasts: { id: string; message: string }[] = $state([])

  function notifyError(message: string) {
    const id = crypto.randomUUID()
    toasts = [...toasts, { id, message }]
    setTimeout(() => dismissToast(id), 10000)
  }

  function dismissToast(id: string) {
    toasts = toasts.filter((t) => t.id !== id)
  }

  // La voz clonada elegida se recuerda entre visitas (localStorage), para no
  // tener que volver a seleccionarla cada vez que se abre la página.
  let referenceId = $state(loadPersisted('referenceId', ''))
  $effect(() => savePersisted('referenceId', referenceId))

  // Generar audio, clonar voces y añadir voces compartidas nuevas necesitan
  // la API key de Fish Audio configurada en el backend (FISH_API_KEY); si
  // falta, esos formularios se deshabilitan con un mensaje claro en vez de
  // dejar que fallen. El resto (favoritos, historial, voces compartidas ya
  // guardadas) no depende de ella y sigue funcionando igual.
  let fishAvailable = $state(true)

  let voices: Voice[] = $state([])

  async function loadVoices() {
    const res = await fetch('/api/voices')
    if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
    voices = await res.json()
  }

  async function init() {
    try {
      const res = await fetch('/api/fish-audio/status')
      const data = res.ok ? await res.json() : { available: false }
      fishAvailable = Boolean(data?.available)
    } catch {
      fishAvailable = false
    }

    if (!fishAvailable) {
      voices = []
      return
    }
    try {
      await loadVoices()
    } catch (err) {
      voices = []
      notifyError(err instanceof Error ? err.message : 'No se han podido cargar tus voces')
    }
  }
  init()

  async function createVoiceApi(title: string, files: File[]) {
    try {
      const form = new FormData()
      form.set('title', title)
      for (const file of files) form.append('voices', file)

      const res = await fetch('/api/voices', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
      await loadVoices()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error creando la voz')
      throw err
    }
  }

  async function deleteVoiceApi(id: string) {
    try {
      const res = await fetch(`/api/voices/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
      await loadVoices()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error eliminando la voz')
      throw err
    }
  }

  let sharedVoices: Voice[] = $state([])

  async function loadSharedVoices() {
    const res = await fetch('/api/shared-voices')
    if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
    sharedVoices = await res.json()
  }
  loadSharedVoices().catch((err) => {
    sharedVoices = []
    notifyError(err instanceof Error ? err.message : 'No se han podido cargar las voces compartidas')
  })

  async function addSharedVoiceApi(input: string) {
    try {
      const res = await fetch('/api/shared-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
      await loadSharedVoices()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error añadiendo la voz compartida')
      throw err
    }
  }

  async function removeSharedVoiceApi(id: string) {
    try {
      const res = await fetch(`/api/shared-voices/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
      await loadSharedVoices()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error quitando la voz compartida')
      throw err
    }
  }

  let favorites: Favorite[] = $state([])

  async function loadFavorites() {
    const res = await fetch('/api/favorites')
    if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
    favorites = await res.json()
  }
  loadFavorites().catch((err) => {
    favorites = []
    notifyError(err instanceof Error ? err.message : 'No se han podido cargar los favoritos')
  })

  function isFavorite(type: Favorite['type'], id: string) {
    return id !== '' && favorites.some((f) => f.type === type && f.id === id)
  }

  async function toggleFavorite(type: Favorite['type'], id: string, label: string) {
    if (!id) return
    try {
      if (isFavorite(type, id)) {
        const res = await fetch(`/api/favorites/${encodeURIComponent(`${type}:${id}`)}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
        favorites = await res.json()
      } else {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, id, label }),
        })
        if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
        favorites = await res.json()
      }
    } catch (err) {
      // Si falla, el estado de favoritos no cambia, pero al menos se avisa
      // (antes fallaba en silencio y no había ninguna forma de saber por qué
      // el botón de favorito no había hecho nada).
      notifyError(err instanceof Error ? err.message : 'Error actualizando favoritos')
    }
  }

  let generations: Generation[] = $state([])

  async function loadGenerations() {
    const res = await fetch('/api/generations')
    if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
    generations = await res.json()
  }
  loadGenerations().catch((err) => {
    generations = []
    notifyError(err instanceof Error ? err.message : 'No se ha podido cargar el historial')
  })

  async function deleteGenerationApi(id: string) {
    try {
      const res = await fetch(`/api/generations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
      await loadGenerations()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Error eliminando la generación')
      throw err
    }
  }
</script>

<main class="container py-4">
  <h1 class="mb-4">FishWeir Audio Frontend</h1>

  <ul class="nav nav-tabs mb-4">
    <li class="nav-item">
      <button type="button" class="nav-link" class:active={tab === 'generar'} onclick={() => (tab = 'generar')}>
        Generar
      </button>
    </li>
    <li class="nav-item">
      <button type="button" class="nav-link" class:active={tab === 'mis-voces'} onclick={() => (tab = 'mis-voces')}>
        Mis voces
      </button>
    </li>
    <li class="nav-item">
      <button type="button" class="nav-link" class:active={tab === 'compartidas'} onclick={() => (tab = 'compartidas')}>
        Voces compartidas
      </button>
    </li>
    <li class="nav-item">
      <button type="button" class="nav-link" class:active={tab === 'historial'} onclick={() => (tab = 'historial')}>
        Historial
      </button>
    </li>
  </ul>

  {#if tab === 'generar'}
    <TextPanel
      {voices}
      {sharedVoices}
      {favorites}
      {fishAvailable}
      bind:referenceId
      {isFavorite}
      onToggleFavorite={toggleFavorite}
      onGenerated={loadGenerations}
      onError={notifyError}
    />
  {:else if tab === 'mis-voces'}
    <MyVoices {voices} {favorites} {fishAvailable} bind:referenceId {isFavorite} onToggleFavorite={toggleFavorite} onCreateVoice={createVoiceApi} onDeleteVoice={deleteVoiceApi} />
  {:else if tab === 'compartidas'}
    <SharedVoices
      {sharedVoices}
      {favorites}
      {fishAvailable}
      bind:referenceId
      {isFavorite}
      onToggleFavorite={toggleFavorite}
      onAddSharedVoice={addSharedVoiceApi}
      onRemoveSharedVoice={removeSharedVoiceApi}
    />
  {:else}
    <GenerationHistory {generations} onDeleteGeneration={deleteGenerationApi} />
  {/if}
</main>

<!-- Toasts globales de error: fijos arriba a la derecha, visibles en
     cualquier pestaña y aunque el componente que disparó el error ya no
     esté montado. Se cierran solos a los 10s o con la ×. -->
<div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 2000;">
  {#each toasts as t (t.id)}
    <div class="alert alert-danger d-flex align-items-start gap-2 shadow-sm mb-2" role="alert">
      <span class="flex-grow-1">{t.message}</span>
      <button type="button" class="btn-close" aria-label="Cerrar" onclick={() => dismissToast(t.id)}></button>
    </div>
  {/each}
</div>
