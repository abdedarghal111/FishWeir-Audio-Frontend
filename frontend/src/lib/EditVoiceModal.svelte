<script lang="ts">
  // Editar una voz ya creada. No hay campo para el audio: no se puede cambiar.
  import { VISIBILITY_OPTIONS, parseTags, type Voice, type VoiceEdit, type VoiceVisibility } from './types'

  let {
    voice,
    onSave,
    onClose,
  }: {
    voice: Voice
    onSave: (edit: VoiceEdit) => Promise<void>
    onClose: () => void
  } = $props()

  // El modal se monta al abrirlo y se destruye al cerrarlo, así que basta con sembrar los
  // campos con los valores de la voz: no hay que reaccionar a cambios posteriores de `voice`.
  /* svelte-ignore state_referenced_locally */
  let title = $state(voice.title)
  /* svelte-ignore state_referenced_locally */
  let description = $state(voice.description ?? '')
  // Una voz pública sólo se puede despublicar desde fish.audio, así que se parte de privada.
  /* svelte-ignore state_referenced_locally */
  let visibility: VoiceVisibility = $state(voice.visibility === 'unlist' ? 'unlist' : 'private')
  /* svelte-ignore state_referenced_locally */
  let tagsInput = $state((voice.tags ?? []).join(', '))
  let cover: File | undefined = $state(undefined)
  let loading = $state(false)
  let error = $state('')

  let tags = $derived(parseTags(tagsInput))
  let canSave = $derived(Boolean(title.trim()) && !loading)

  let coverUrl = $state('')
  $effect(() => {
    if (!cover) {
      coverUrl = ''
      return
    }
    const url = URL.createObjectURL(cover)
    coverUrl = url
    return () => URL.revokeObjectURL(url)
  })

  async function save(e: Event) {
    e.preventDefault()
    if (!canSave) return

    loading = true
    error = ''
    try {
      await onSave({ title: title.trim(), description, visibility, tags, coverImage: cover })
      onClose()
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error guardando la voz'
    } finally {
      loading = false
    }
  }

  function closeOnEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
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
  aria-label="Editar voz"
  style="background: rgba(0, 0, 0, 0.5);"
  onclick={onClose}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-dialog modal-lg modal-dialog-scrollable" onclick={(e) => e.stopPropagation()}>
    <div class="modal-content">
      <form onsubmit={save}>
        <div class="modal-header">
          <h5 class="modal-title"><i class="fa-solid fa-pen" aria-hidden="true"></i> Editar voz</h5>
          <button type="button" class="btn-close" aria-label="Cerrar" onclick={onClose}></button>
        </div>

        <div class="modal-body d-flex flex-column gap-3">
          <div>
            <label class="form-label" for="edit-title">Título</label>
            <input id="edit-title" type="text" class="form-control" bind:value={title} required />
          </div>

          <div>
            <label class="form-label" for="edit-description">Descripción</label>
            <textarea id="edit-description" class="form-control" rows="2" bind:value={description}></textarea>
          </div>

          <div>
            <label class="form-label" for="edit-tags">Etiquetas</label>
            <input id="edit-tags" type="text" class="form-control" bind:value={tagsInput} placeholder="narracion, grave, es" />
            {#if tags.length > 0}
              <div class="d-flex flex-wrap gap-1 mt-2">
                {#each tags as tag (tag)}<span class="badge text-bg-light border">#{tag}</span>{/each}
              </div>
            {:else}
              <p class="form-text mb-0">Separadas por comas. Si lo dejas vacío se quitan todas.</p>
            {/if}
          </div>

          <div>
            <label class="form-label" for="edit-visibility">Visibilidad</label>
            <select id="edit-visibility" class="form-select" bind:value={visibility}>
              {#each VISIBILITY_OPTIONS as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
            <p class="form-text mb-0">
              {VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.hint}
              {#if voice.visibility === 'public'}
                Esta voz está publicada en el catálogo: despublicarla desde aquí puede no tener efecto, hazlo en
                <a href="https://fish.audio/app/my-voices" target="_blank" rel="noopener noreferrer">fish.audio</a>.
              {/if}
            </p>
          </div>

          <div>
            <label class="form-label" for="edit-cover">Imagen de portada</label>
            <div class="d-flex align-items-center gap-3">
              {#if coverUrl || voice.coverImage}
                <img src={coverUrl || voice.coverImage} alt="" class="rounded object-fit-cover flex-shrink-0"
                  style="width: 4.5rem; height: 4.5rem;" />
              {/if}
              <input id="edit-cover" type="file" accept="image/*" class="form-control"
                onchange={(e) => (cover = (e.target as HTMLInputElement).files?.[0])} />
            </div>
            <p class="form-text mb-0">Si no eliges una imagen nueva, se mantiene la actual.</p>
          </div>

          <p class="text-body-secondary small mb-0">
            El audio de referencia no se puede cambiar: para eso hay que crear una voz nueva y borrar esta.
          </p>

          {#if error}<div class="alert alert-danger py-2 mb-0">{error}</div>{/if}
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" onclick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled={!canSave}>
            {#if loading}<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>{/if}
            {loading ? 'Guardando...' : 'Guardar'}
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
</style>
