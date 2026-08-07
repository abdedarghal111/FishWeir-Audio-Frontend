<script lang="ts">
  // Clonación instantánea a partir de audios de referencia.
  let {
    onCreateVoice,
  }: {
    onCreateVoice: (title: string, files: File[]) => Promise<void>
  } = $props()

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
      await onCreateVoice(newTitle, newFiles)
      newTitle = ''
      newFiles = []
    } catch (err) {
      voicesError = err instanceof Error ? err.message : 'Error creando la voz'
    } finally {
      voicesLoading = false
    }
  }
</script>

<section>
  <h3 class="h5">Clonar voz nueva</h3>
  <p class="text-body-secondary small">
    Sube uno o varios audios de referencia para crear una voz clonada; en cuanto esté lista aparecerá en la
    biblioteca de la derecha y podrás elegirla con "Seleccionar voz".
  </p>
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

    {#if voicesError}<div class="alert alert-danger py-2 mb-0">{voicesError}</div>{/if}
  </form>
</section>

<style>
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
