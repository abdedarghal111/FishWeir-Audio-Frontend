<script lang="ts">
  // Todo en un solo componente: dos pestañas (TTS y voces), llamando directamente
  // a nuestro backend con fetch. Nada de capas/abstracciones para tan poca lógica.

  type Voice = {
    id: string
    title: string
    description?: string
    coverImage?: string
    state?: 'created' | 'training' | 'trained' | 'failed'
    tags?: string[]
    createdAt?: string
    updatedAt?: string
    visibility?: 'public' | 'unlist' | 'private'
    likeCount?: number
    markCount?: number
    sharedCount?: number
    taskCount?: number
    author?: { _id: string; nickname: string; avatar: string }
    trainMode?: 'fast' | 'full'
    languages?: string[]
    samples?: { title: string; text: string; task_id: string; audio: string }
  }

  const STATE_LABELS: Record<string, string> = {
    created: 'Creada',
    training: 'Entrenando',
    trained: 'Entrenada',
    failed: 'Fallida',
  }
  const STATE_BADGES: Record<string, string> = {
    created: 'text-bg-secondary',
    training: 'text-bg-warning',
    trained: 'text-bg-success',
    failed: 'text-bg-danger',
  }
  const VISIBILITY_LABELS: Record<string, string> = {
    private: 'Privada',
    unlist: 'No listada',
    public: 'Pública',
  }

  function formatDate(iso?: string) {
    if (!iso) return ''
    return new Date(iso).toLocaleString()
  }

  const MODELS = [
    { value: 's2.1-pro-free', label: 's2.1-pro-free (gratis, para pruebas)' },
    { value: 's2.1-pro', label: 's2.1-pro (por defecto en producción)' },
    { value: 's2-pro', label: 's2-pro' },
    { value: 's1', label: 's1' },
  ]

  let tab: 'tts' | 'voices' = $state('tts')
  let voices: Voice[] = $state([])

  async function loadVoices() {
    try {
      const res = await fetch('/api/voices')
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? `Error ${res.status}`)
      voices = await res.json()
    } catch (err) {
      voices = []
      voicesError = err instanceof Error ? err.message : 'Error cargando tus voces'
    }
  }
  loadVoices()

  // --- Favoritos (modelos base y voces clonadas, para elegir rápido) ---
  type Favorite = { key: string; type: 'model' | 'voice'; id: string; label: string }
  let favorites: Favorite[] = $state([])

  async function loadFavorites() {
    try {
      const res = await fetch('/api/favorites')
      favorites = res.ok ? await res.json() : []
    } catch {
      favorites = []
    }
  }
  loadFavorites()

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

  function selectFavorite(fav: Favorite) {
    if (fav.type === 'model') model = fav.id
    else referenceId = fav.id
  }

  // --- TTS ---
  let text = $state('')
  let model = $state('s2.1-pro-free')
  let referenceId = $state('')
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
        body: JSON.stringify({ text, model, referenceId: referenceId || undefined }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? `Error ${res.status}`)

      if (audioUrl) URL.revokeObjectURL(audioUrl)
      audioUrl = URL.createObjectURL(await res.blob())
    } catch (err) {
      ttsError = err instanceof Error ? err.message : 'Error generando el audio'
    } finally {
      ttsLoading = false
    }
  }

  // --- Voces clonadas ---
  let newTitle = $state('')
  let newFiles: File[] = $state([])
  let voicesLoading = $state(false)
  let voicesError = $state('')

  let dragging = $state(false)

  function onFilesChange(e: Event) {
    newFiles = Array.from((e.target as HTMLInputElement).files ?? [])
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    dragging = false
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length > 0) newFiles = files
  }

  async function createVoice(e: Event) {
    e.preventDefault()
    if (!newTitle.trim() || newFiles.length === 0) return

    voicesLoading = true
    voicesError = ''
    try {
      const form = new FormData()
      form.set('title', newTitle)
      for (const file of newFiles) form.append('voices', file)

      const res = await fetch('/api/voices', { method: 'POST', body: form })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? `Error ${res.status}`)

      newTitle = ''
      newFiles = []
      await loadVoices()
    } catch (err) {
      voicesError = err instanceof Error ? err.message : 'Error creando la voz'
    } finally {
      voicesLoading = false
    }
  }

  async function deleteVoice(id: string) {
    try {
      const res = await fetch(`/api/voices/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? `Error ${res.status}`)
      await loadVoices()
    } catch (err) {
      voicesError = err instanceof Error ? err.message : 'Error eliminando la voz'
    }
  }
</script>

<main class="container py-4" style="max-width: 640px;">
  <h1 class="mb-4">Fish Audio</h1>

  <ul class="nav nav-tabs mb-4">
    <li class="nav-item">
      <button type="button" class="nav-link" class:active={tab === 'tts'} onclick={() => (tab = 'tts')}>
        Texto a voz
      </button>
    </li>
    <li class="nav-item">
      <button type="button" class="nav-link" class:active={tab === 'voices'} onclick={() => (tab = 'voices')}>
        Voces clonadas
      </button>
    </li>
  </ul>

  {#if tab === 'tts'}
    {#if favorites.length > 0}
      <section class="card mb-4">
        <div class="card-body">
          <h3 class="h6 card-title mb-2">⭐ Favoritos</h3>
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
                  {fav.type === 'model' ? '🤖' : '🎙️'} {fav.label}
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  title="Quitar de favoritos"
                  onclick={() => toggleFavorite(fav.type, fav.id, fav.label)}
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
        </div>
      </section>
    {/if}

    <form onsubmit={generateSpeech} class="d-flex flex-column gap-3">
      <div>
        <label class="form-label" for="text">Texto</label>
        <textarea
          id="text"
          class="form-control"
          bind:value={text}
          rows="4"
          placeholder="Escribe el texto a convertir en audio..."
          required
        ></textarea>
      </div>

      <div class="row g-3">
        <div class="col">
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
              onclick={() => toggleFavorite('model', model, MODELS.find((m) => m.value === model)?.label ?? model)}
            >
              {isFavorite('model', model) ? '★' : '☆'}
            </button>
          </div>
        </div>

        <div class="col">
          <label class="form-label" for="referenceId">Voz clonada (opcional)</label>
          <div class="d-flex gap-2">
            <select id="referenceId" class="form-select" bind:value={referenceId}>
              <option value="">Voz por defecto</option>
              {#each voices as voice (voice.id)}
                <option value={voice.id}>{voice.title}</option>
              {/each}
            </select>
            <button
              type="button"
              class="btn btn-outline-secondary flex-shrink-0"
              disabled={!referenceId}
              title={isFavorite('voice', referenceId) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              onclick={() => toggleFavorite('voice', referenceId, voices.find((v) => v.id === referenceId)?.title ?? referenceId)}
            >
              {isFavorite('voice', referenceId) ? '★' : '☆'}
            </button>
          </div>
        </div>
      </div>

      <button type="submit" class="btn btn-primary align-self-start" disabled={ttsLoading}>
        {#if ttsLoading}<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>{/if}
        {ttsLoading ? 'Generando...' : 'Generar audio'}
      </button>

      {#if ttsError}<div class="alert alert-danger py-2 mb-0">{ttsError}</div>{/if}
      {#if audioUrl}<audio controls src={audioUrl} class="w-100"></audio>{/if}
    </form>
  {:else}
    <section class="mb-4">
      <h3 class="h5">Tus voces clonadas</h3>
      {#if voices.length === 0}
        <p class="text-body-secondary">Todavía no tienes ninguna voz clonada.</p>
      {:else}
        <div class="d-flex flex-column gap-3">
          {#each voices as voice (voice.id)}
            <div class="card">
              <div class="card-body d-flex gap-3">
                {#if voice.coverImage}
                  <img
                    src={voice.coverImage}
                    alt=""
                    class="rounded object-fit-cover flex-shrink-0"
                    style="width: 4.5rem; height: 4.5rem;"
                  />
                {/if}
                <div class="flex-grow-1" style="min-width: 0;">
                  <div class="d-flex justify-content-between align-items-start gap-2">
                    <h4 class="h6 mb-1 text-truncate">{voice.title}</h4>
                    <div class="d-flex gap-2 flex-shrink-0">
                      <button
                        type="button"
                        class="btn btn-sm btn-outline-secondary"
                        title={isFavorite('voice', voice.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                        onclick={() => toggleFavorite('voice', voice.id, voice.title)}
                      >
                        {isFavorite('voice', voice.id) ? '★' : '☆'}
                      </button>
                      <button type="button" class="btn btn-sm btn-outline-danger" onclick={() => deleteVoice(voice.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div class="d-flex flex-wrap gap-1 mb-2">
                    {#if voice.state}
                      <span class="badge {STATE_BADGES[voice.state] ?? 'text-bg-secondary'}">{STATE_LABELS[voice.state] ?? voice.state}</span>
                    {/if}
                    {#if voice.visibility}
                      <span class="badge text-bg-light border">{VISIBILITY_LABELS[voice.visibility] ?? voice.visibility}</span>
                    {/if}
                    {#if voice.trainMode}
                      <span class="badge text-bg-light border">Entrenamiento: {voice.trainMode}</span>
                    {/if}
                    {#each voice.languages ?? [] as lang (lang)}
                      <span class="badge text-bg-light border">{lang}</span>
                    {/each}
                    {#each voice.tags ?? [] as tag (tag)}
                      <span class="badge text-bg-light border">#{tag}</span>
                    {/each}
                  </div>

                  {#if voice.description}
                    <p class="mb-2 text-body-secondary">{voice.description}</p>
                  {/if}

                  <div class="d-flex flex-wrap gap-3 small text-body-secondary mb-2">
                    <span>❤️ {voice.likeCount ?? 0} me gusta</span>
                    <span>🔖 {voice.markCount ?? 0} guardados</span>
                    <span>🔁 {voice.sharedCount ?? 0} compartidos</span>
                    <span>▶️ {voice.taskCount ?? 0} generaciones</span>
                  </div>

                  <div class="d-flex flex-wrap gap-3 small text-body-secondary mb-2">
                    <span>Creada: {formatDate(voice.createdAt)}</span>
                    {#if voice.updatedAt && voice.updatedAt !== voice.createdAt}
                      <span>Actualizada: {formatDate(voice.updatedAt)}</span>
                    {/if}
                  </div>

                  {#if voice.author?.nickname}
                    <div class="d-flex align-items-center gap-2 small text-body-secondary mb-2">
                      {#if voice.author.avatar}
                        <img src={voice.author.avatar} alt="" class="rounded-circle" width="20" height="20" />
                      {/if}
                      <span>Autor: {voice.author.nickname}</span>
                    </div>
                  {/if}

                  {#if voice.samples?.audio}
                    <audio controls src={voice.samples.audio} class="w-100"></audio>
                  {/if}

                  <details class="mt-2 small">
                    <summary class="text-body-secondary" style="cursor: pointer;">ID y datos técnicos</summary>
                    <code class="d-block mt-1 text-break">{voice.id}</code>
                  </details>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
      {#if voicesError}<div class="alert alert-danger py-2 mt-3 mb-0">{voicesError}</div>{/if}
    </section>

    <section>
      <h3 class="h5">Crear voz nueva (clonación instantánea)</h3>
      <form onsubmit={createVoice} class="d-flex flex-column gap-3">
        <div>
          <label class="form-label" for="newTitle">Título</label>
          <input id="newTitle" type="text" class="form-control" bind:value={newTitle} placeholder="Ej: Mi voz" required />
        </div>

        <div>
          <span class="form-label d-block">Audio(s) de referencia</span>
          <label
            class="dropzone form-control d-flex align-items-center justify-content-center text-center"
            class:dragging
            ondragover={(e) => (e.preventDefault(), (dragging = true))}
            ondragleave={() => (dragging = false)}
            ondrop={onDrop}
          >
            {#if newFiles.length > 0}
              <span>{newFiles.length} archivo(s) seleccionado(s)</span>
            {:else}
              <span class="text-body-secondary">Arrastra aquí los audios de referencia, o haz click para elegirlos</span>
            {/if}
            <input type="file" accept="audio/*" multiple onchange={onFilesChange} hidden />
          </label>
        </div>

        <button type="submit" class="btn btn-primary align-self-start" disabled={voicesLoading || !newTitle.trim() || newFiles.length === 0}>
          {#if voicesLoading}<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>{/if}
          {voicesLoading ? 'Creando...' : 'Crear voz'}
        </button>
      </form>
    </section>
  {/if}
</main>

<style>
  /* Bootstrap no trae un componente de dropzone; el resto de la UI usa solo
     clases de Bootstrap, así que dejamos aquí el único CSS a medida que hace falta. */
  .dropzone {
    height: auto;
    min-height: 88px;
    border: 2px dashed var(--bs-border-color);
    cursor: pointer;
  }

  .dropzone.dragging {
    border-color: var(--bs-primary);
    background: var(--bs-primary-bg-subtle);
  }
</style>
