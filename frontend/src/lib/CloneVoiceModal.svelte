<script module lang="ts">
  // Persistente: vive en el módulo, así que lo escrito sobrevive a cerrar el modal o a
  // cambiar de pestaña. Sólo se limpia al crear la voz con éxito.
  let newTitle = $state('')
  let newFiles: File[] = $state([])
  let newTexts: string[] = $state([])
  let newDescription = $state('')
  let newTagsInput = $state('')
  let newVisibility: VoiceVisibility = $state('private')
  let newCover: File | undefined = $state(undefined)
  let newEnhance = $state(true)
  let newGenerateSample = $state(false)
  let showTexts = $state(false)
  let voicesLoading = $state(false)
  let voicesError = $state('')
  let lastQuality: AudioQuality[] = $state([])

  // Lo consulta "Mis voces" para avisar de que hay un borrador a medias.
  export function hasDraft() {
    return Boolean(newTitle.trim()) || newFiles.length > 0
  }
</script>

<script lang="ts">
  // Clonación instantánea a partir de audios de referencia.
  import {
    AUDIO_EXTENSIONS,
    MAX_VOICE_FILES,
    VISIBILITY_OPTIONS,
    formatBytes,
    parseTags,
    type AudioQuality,
    type NewVoice,
    type Voice,
    type VoiceVisibility,
  } from './types'

  let {
    onCreateVoice,
    onClose,
  }: {
    onCreateVoice: (voice: NewVoice) => Promise<Voice>
    onClose: () => void
  } = $props()

  let dragging = $state(false)

  let tags = $derived(parseTags(newTagsInput))
  let invalidFiles = $derived(newFiles.filter((file) => !AUDIO_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))))
  let tooManyFiles = $derived(newFiles.length > MAX_VOICE_FILES)
  let canSubmit = $derived(Boolean(newTitle.trim()) && newFiles.length > 0 && invalidFiles.length === 0 && !tooManyFiles)

  // Preview de la portada; se libera el object URL al cambiar de imagen o al cerrar el modal.
  let coverUrl = $state('')
  $effect(() => {
    if (!newCover) {
      coverUrl = ''
      return
    }
    const url = URL.createObjectURL(newCover)
    coverUrl = url
    return () => URL.revokeObjectURL(url)
  })

  function addFiles(files: File[]) {
    if (files.length === 0) return
    newFiles = [...newFiles, ...files]
    // Una transcripción por audio, en el mismo orden: se mantienen alineadas.
    newTexts = newFiles.map((_, i) => newTexts[i] ?? '')
  }

  function removeFile(index: number) {
    newFiles = newFiles.filter((_, i) => i !== index)
    newTexts = newTexts.filter((_, i) => i !== index)
  }

  function onFilesChange(e: Event) {
    const input = e.target as HTMLInputElement
    addFiles(Array.from(input.files ?? []))
    // Permite volver a elegir el mismo archivo después de quitarlo.
    input.value = ''
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    dragging = false
    addFiles(Array.from(e.dataTransfer?.files ?? []))
  }

  function onCoverChange(e: Event) {
    newCover = (e.target as HTMLInputElement).files?.[0]
  }

  function reset() {
    newTitle = ''
    newFiles = []
    newTexts = []
    newDescription = ''
    newTagsInput = ''
    newVisibility = 'private'
    newCover = undefined
    newEnhance = true
    newGenerateSample = false
    showTexts = false
  }

  async function createVoice(e: Event) {
    e.preventDefault()
    if (!canSubmit) return

    voicesLoading = true
    voicesError = ''
    lastQuality = []
    try {
      const created = await onCreateVoice({
        title: newTitle,
        files: newFiles,
        texts: newTexts,
        description: newDescription,
        tags,
        visibility: newVisibility,
        coverImage: newCover,
        enhanceAudioQuality: newEnhance,
        generateSample: newGenerateSample,
      })
      lastQuality = created.quality ?? []
      reset()
      // El modal no se cierra solo: el análisis de los audios sólo llega en esta respuesta,
      // así que cerrarlo aquí lo haría desaparecer sin que diera tiempo a leerlo.
    } catch (err) {
      voicesError = err instanceof Error ? err.message : 'Error creando la voz'
    } finally {
      voicesLoading = false
    }
  }

  function close() {
    // Cerrar a media creación dejaría al usuario sin saber si la voz se creó o no.
    if (!voicesLoading) onClose()
  }

  function closeOnEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }
</script>

<svelte:window onkeydown={closeOnEscape} />

<!-- El backdrop cierra al hacer click; Escape (svelte:window arriba) cubre el teclado. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="modal d-block"
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-label="Clonar voz nueva"
  style="background: rgba(0, 0, 0, 0.5);"
  onclick={close}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-dialog modal-lg modal-dialog-scrollable" onclick={(e) => e.stopPropagation()}>
    <div class="modal-content">
      <form onsubmit={createVoice}>
        <div class="modal-header">
          <h5 class="modal-title"><i class="fa-solid fa-clone" aria-hidden="true"></i> Clonar voz nueva</h5>
          <button type="button" class="btn-close" aria-label="Cerrar" onclick={close} disabled={voicesLoading}></button>
        </div>

        <div class="modal-body d-flex flex-column gap-3">
          <p class="text-body-secondary small mb-0">
            Sube uno o varios audios de referencia para crear una voz clonada; en cuanto esté lista aparecerá en tu lista
            de voces y podrás elegirla con "Seleccionar voz". Lo que escribas aquí se conserva aunque cierres esta
            ventana.
          </p>

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
              <span class="text-body-secondary">Arrastra aquí los audios de referencia, o haz click para elegirlos</span>
              <input type="file" accept={AUDIO_EXTENSIONS.join(',')} multiple onchange={onFilesChange} hidden />
            </label>

            <p class="form-text mb-0">
              De 1 a {MAX_VOICE_FILES} archivos en {AUDIO_EXTENSIONS.join(', ')}. Fish Audio recomienda al menos 10 segundos por
              clip, e idealmente 2 o 3 clips de 15 a 20 segundos: mono, un solo hablante, volumen estable y sin música ni
              reverberación.
            </p>

            {#if newFiles.length > 0}
              <ul class="list-group list-group-flush mt-2">
                {#each newFiles as file, i (file.name + i)}
                  <li class="list-group-item d-flex align-items-center gap-2 px-0 py-1">
                    <i class="fa-solid fa-file-audio text-body-secondary" aria-hidden="true"></i>
                    <span class="text-truncate flex-grow-1">{file.name}</span>
                    <span class="text-body-secondary small flex-shrink-0">{formatBytes(file.size)}</span>
                    <button type="button" class="btn btn-sm btn-link text-danger p-0" onclick={() => removeFile(i)} aria-label="Quitar {file.name}">
                      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}

            {#if invalidFiles.length > 0}
              <div class="alert alert-danger py-2 mt-2 mb-0">
                Formato no admitido: {invalidFiles.map((f) => f.name).join(', ')}.
              </div>
            {/if}
            {#if tooManyFiles}
              <div class="alert alert-danger py-2 mt-2 mb-0">
                Has añadido {newFiles.length} archivos; el máximo es {MAX_VOICE_FILES}.
              </div>
            {/if}
          </div>

          {#if newFiles.length > 0}
            <div>
              <button type="button" class="btn btn-sm btn-link p-0" onclick={() => (showTexts = !showTexts)}>
                <i class="fa-solid fa-chevron-{showTexts ? 'down' : 'right'} me-1" aria-hidden="true"></i>
                Transcripciones (opcional)
              </button>
              {#if showTexts}
                <p class="form-text mt-1">
                  Si las dejas vacías, Fish Audio transcribe los audios automáticamente. Rellenarlas afina la pronunciación,
                  pero sólo se envían si están <strong>todas</strong>: una transcripción suelta se emparejaría con el audio
                  equivocado.
                </p>
                <div class="d-flex flex-column gap-2">
                  {#each newFiles as file, i (file.name + i)}
                    <div>
                      <label class="form-label small mb-1" for="text-{i}">{file.name}</label>
                      <textarea id="text-{i}" class="form-control form-control-sm" rows="2" bind:value={newTexts[i]}
                        placeholder="Lo que se dice en este audio"></textarea>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          <div>
            <label class="form-label" for="newDescription">Descripción (opcional)</label>
            <textarea id="newDescription" class="form-control" rows="2" bind:value={newDescription}
              placeholder="Ej: voz grave de narrador, grabada con micro de estudio"></textarea>
          </div>

          <div>
            <label class="form-label" for="newTags">Etiquetas (opcional)</label>
            <input id="newTags" type="text" class="form-control" bind:value={newTagsInput} placeholder="narracion, grave, es" />
            {#if tags.length > 0}
              <div class="d-flex flex-wrap gap-1 mt-2">
                {#each tags as tag (tag)}<span class="badge text-bg-light border">#{tag}</span>{/each}
              </div>
            {:else}
              <p class="form-text mb-0">Separadas por comas.</p>
            {/if}
          </div>

          <div>
            <label class="form-label" for="newVisibility">Visibilidad</label>
            <select id="newVisibility" class="form-select" bind:value={newVisibility}>
              {#each VISIBILITY_OPTIONS as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
            <p class="form-text mb-0">
              {VISIBILITY_OPTIONS.find((o) => o.value === newVisibility)?.hint}
              Publicar una voz en el catálogo de Fish Audio sólo se puede desde
              <a href="https://fish.audio/app/my-voices" target="_blank" rel="noopener noreferrer">fish.audio</a>.
            </p>
          </div>

          <div>
            <label class="form-label" for="newCover">Imagen de portada (opcional)</label>
            <div class="d-flex align-items-center gap-3">
              {#if coverUrl}
                <img src={coverUrl} alt="" class="rounded object-fit-cover flex-shrink-0" style="width: 4.5rem; height: 4.5rem;" />
              {/if}
              <input id="newCover" type="file" accept="image/*" class="form-control" onchange={onCoverChange} />
              {#if newCover}
                <button type="button" class="btn btn-sm btn-outline-secondary flex-shrink-0" onclick={() => (newCover = undefined)}>
                  Quitar
                </button>
              {/if}
            </div>
          </div>

          <div>
            <div class="form-check">
              <input id="newEnhance" type="checkbox" class="form-check-input" bind:checked={newEnhance} />
              <label class="form-check-label" for="newEnhance">Mejorar la calidad del audio</label>
            </div>
            <p class="form-text mt-0">
              Quita ruido de fondo y normaliza el volumen antes de entrenar. Desactívalo si el audio ya es de calidad de estudio.
            </p>

            <div class="form-check">
              <input id="newGenerateSample" type="checkbox" class="form-check-input" bind:checked={newGenerateSample} />
              <label class="form-check-label" for="newGenerateSample">Generar una muestra de ejemplo</label>
            </div>
            <p class="form-text mt-0 mb-0">Crea un audio de prueba que podrás escuchar desde la tarjeta de la voz.</p>
          </div>

          <div class="alert alert-warning py-2 mb-0 small">
            <i class="fa-solid fa-triangle-exclamation me-1" aria-hidden="true"></i>
            Clona sólo tu propia voz o voces para las que tengas permiso por escrito de su titular.
          </div>

          {#if voicesError}<div class="alert alert-danger py-2 mb-0">{voicesError}</div>{/if}

          {#if lastQuality.length > 0}
            <!-- Fish Audio analiza cada audio al crear la voz y dice cuáles no le sirven y por qué. -->
            <div class="alert alert-info py-2 mb-0">
              <strong class="d-block mb-1">Análisis de los audios</strong>
              <ul class="mb-0 ps-3">
                {#each lastQuality as audio (audio.filename)}
                  <li>
                    <i class="fa-solid fa-{audio.quality_passed ? 'check text-success' : 'xmark text-danger'} me-1" aria-hidden="true"></i>
                    {audio.filename} ({(audio.duration_ms / 1000).toFixed(1)} s)
                    {#if audio.quality_reason}— {audio.quality_reason}{/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" onclick={close} disabled={voicesLoading}>Cerrar</button>
          <button type="submit" class="btn btn-primary" disabled={voicesLoading || !canSubmit}>
            {#if voicesLoading}<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>{/if}
            {voicesLoading ? 'Creando...' : 'Crear voz'}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<style>
  /* Bootstrap da el scroll al .modal-body, pero espera que header/body/footer sean hijos
     directos de .modal-content. Aquí el <form> se interpone y rompe esa cadena flex, así que
     el formulario se salía de la pantalla en vez de hacer scroll: el form la hereda. */
  .modal-content > form {
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: 100%;
  }

  /* Bootstrap no trae un componente de dropzone; CSS a medida solo para esto. */
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
