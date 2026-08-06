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

  // La voz clonada elegida se recuerda entre visitas (localStorage), para no
  // tener que volver a seleccionarla cada vez que se abre la página.
  let referenceId = $state(loadPersisted('referenceId', ''))
  $effect(() => savePersisted('referenceId', referenceId))

  // --- Voces propias ---
  let voices: Voice[] = $state([])

  async function loadVoices() {
    const res = await fetch('/api/voices')
    if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
    voices = await res.json()
  }
  loadVoices().catch(() => (voices = []))

  async function createVoiceApi(title: string, files: File[]) {
    const form = new FormData()
    form.set('title', title)
    for (const file of files) form.append('voices', file)

    const res = await fetch('/api/voices', { method: 'POST', body: form })
    if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
    await loadVoices()
  }

  async function deleteVoiceApi(id: string) {
    const res = await fetch(`/api/voices/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
    await loadVoices()
  }

  // --- Voces compartidas (de otros autores, guardadas por enlace o ID) ---
  let sharedVoices: Voice[] = $state([])

  async function loadSharedVoices() {
    const res = await fetch('/api/shared-voices')
    sharedVoices = res.ok ? await res.json() : []
  }
  loadSharedVoices().catch(() => (sharedVoices = []))

  async function addSharedVoiceApi(input: string) {
    const res = await fetch('/api/shared-voices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    })
    if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
    await loadSharedVoices()
  }

  async function removeSharedVoiceApi(id: string) {
    await fetch(`/api/shared-voices/${id}`, { method: 'DELETE' })
    await loadSharedVoices()
  }

  // --- Favoritos (modelos base y voces clonadas, para elegir rápido) ---
  let favorites: Favorite[] = $state([])

  async function loadFavorites() {
    const res = await fetch('/api/favorites')
    favorites = res.ok ? await res.json() : []
  }
  loadFavorites().catch(() => (favorites = []))

  function isFavorite(type: Favorite['type'], id: string) {
    return id !== '' && favorites.some((f) => f.type === type && f.id === id)
  }

  async function toggleFavorite(type: Favorite['type'], id: string, label: string) {
    if (!id) return
    try {
      if (isFavorite(type, id)) {
        const res = await fetch(`/api/favorites/${encodeURIComponent(`${type}:${id}`)}`, { method: 'DELETE' })
        if (res.ok) favorites = await res.json()
      } else {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, id, label }),
        })
        if (res.ok) favorites = await res.json()
      }
    } catch {
      // Si falla, el estado de favoritos simplemente no cambia; no es crítico.
    }
  }

  // --- Historial de audios generados (guardados en el servidor) ---
  let generations: Generation[] = $state([])

  async function loadGenerations() {
    const res = await fetch('/api/generations')
    generations = res.ok ? await res.json() : []
  }
  loadGenerations().catch(() => (generations = []))

  async function deleteGenerationApi(id: string) {
    const res = await fetch(`/api/generations/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
    await loadGenerations()
  }
</script>

<main class="container py-4">
  <h1 class="mb-4">Fish Audio</h1>

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
      bind:referenceId
      {isFavorite}
      onToggleFavorite={toggleFavorite}
      onGenerated={loadGenerations}
    />
  {:else if tab === 'mis-voces'}
    <MyVoices {voices} {favorites} bind:referenceId {isFavorite} onToggleFavorite={toggleFavorite} onCreateVoice={createVoiceApi} onDeleteVoice={deleteVoiceApi} />
  {:else if tab === 'compartidas'}
    <SharedVoices
      {sharedVoices}
      {favorites}
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
