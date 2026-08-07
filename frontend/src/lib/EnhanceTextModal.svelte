<script lang="ts">
  // Modal "Mejorar con IA": llama a DeepSeek para insertar marcadores de emoción/tono
  // y muestra un diff antes de aceptar. No llama a la API hasta pulsar "Generar".
  import { errorMessage } from './types'
  import { diffWords } from './diff'

  let {
    text,
    model,
    onAccept,
    onClose,
  }: {
    text: string
    // Determina la sintaxis de marcadores: corchetes en s2-pro/s2.1-pro, paréntesis en s1.
    model: string
    onAccept: (newText: string) => void
    onClose: () => void
  } = $props()

  let context = $state('')
  let loading = $state(false)
  let error = $state('')
  let result = $state('')

  let diffParts = $derived(result ? diffWords(text, result) : [])

  async function generate() {
    loading = true
    error = ''
    result = ''
    try {
      const res = await fetch('/api/enhance-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model, context: context.trim() || undefined }),
      })
      if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
      const data = await res.json()
      result = data.enhancedText ?? ''
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error generando el texto'
    } finally {
      loading = false
    }
  }

  function accept() {
    onAccept(result)
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
  aria-label="Mejorar texto con IA"
  style="background: rgba(0, 0, 0, 0.5);"
  onclick={onClose}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-dialog modal-lg" onclick={(e) => e.stopPropagation()}>
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Mejorar con IA</h5>
        <button type="button" class="btn-close" aria-label="Cerrar" onclick={onClose}></button>
      </div>
      <div class="modal-body d-flex flex-column gap-3">
        <div>
          <label class="form-label" for="enhance-context">Contexto de la escena (opcional)</label>
          <textarea
            id="enhance-context"
            class="form-control"
            rows="2"
            placeholder="Ej: es una despedida triste entre dos amigos que no volverán a verse..."
            bind:value={context}
            disabled={loading}
          ></textarea>
          <p class="form-text mb-0">Ayuda a la IA a elegir mejor las emociones. No se añade al texto, solo se usa para decidir los marcadores.</p>
        </div>

        <button type="button" class="btn btn-primary" onclick={generate} disabled={loading}>
          {#if loading}<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>{/if}
          <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
          {loading ? 'Generando...' : result ? 'Generar de nuevo' : 'Generar'}
        </button>

        {#if error}<div class="alert alert-danger py-2 mb-0">{error}</div>{/if}

        {#if result}
          <div>
            <span class="form-label d-block">Resultado (comparado con el original)</span>
            <div class="diff-box">
              {#each diffParts as part, i (i)}
                {#if part.type === 'equal'}<span>{part.text}</span
                >{:else if part.type === 'insert'}<span class="diff-insert">{part.text}</span
                >{:else}<span class="diff-delete">{part.text}</span>{/if}
              {/each}
            </div>
          </div>
        {/if}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" onclick={onClose}>Cancelar</button>
        <button type="button" class="btn btn-success" onclick={accept} disabled={!result || loading}>
          <i class="fa-solid fa-check" aria-hidden="true"></i> Aceptar cambios
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .diff-box {
    white-space: pre-wrap;
    padding: 0.75rem;
    border: 1px solid var(--bs-border-color);
    border-radius: var(--bs-border-radius);
    background: var(--bs-secondary-bg);
    max-height: 40vh;
    overflow-y: auto;
    line-height: 1.6;
  }
  .diff-insert {
    background: rgba(25, 135, 84, 0.25);
    border-radius: 0.2rem;
  }
  .diff-delete {
    background: rgba(220, 53, 69, 0.25);
    text-decoration: line-through;
    border-radius: 0.2rem;
  }
</style>
