<script lang="ts">
  // Pestaña "Historial": todos los audios ya generados (guardados en el
  // servidor con su texto/modelo/voz), a ancho completo para poder verlos
  // más cómodamente que en la columna estrecha del panel de biblioteca.
  import { formatBytes, formatDate, type Generation } from './types'

  let {
    generations,
    onDeleteGeneration,
  }: {
    generations: Generation[]
    onDeleteGeneration: (id: string) => Promise<void>
  } = $props()

  let generationsError = $state('')

  async function deleteGeneration(id: string) {
    try {
      await onDeleteGeneration(id)
    } catch (err) {
      generationsError = err instanceof Error ? err.message : 'Error eliminando la generación'
    }
  }
</script>

<h2 class="h5 mb-3">Audios generados</h2>

{#if generations.length === 0}
  <p class="text-body-secondary">Todavía no has generado ningún audio.</p>
{:else}
  <div class="row g-3">
    {#each generations as g (g.id)}
      <div class="col-md-6 col-lg-4">
        <div class="card h-100">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
              <p class="mb-0" title={g.text}>{g.text}</p>
              <button type="button" class="btn btn-sm btn-outline-danger flex-shrink-0" onclick={() => deleteGeneration(g.id)}>
                <i class="fa-solid fa-trash" aria-hidden="true"></i> Eliminar
              </button>
            </div>
            <div class="d-flex flex-wrap gap-2 small text-body-secondary mb-2">
              <span><i class="fa-solid fa-robot" aria-hidden="true"></i> {g.model}</span>
              <span><i class="fa-solid fa-microphone" aria-hidden="true"></i> {g.voiceTitle ?? 'voz por defecto'}</span>
              <span>{formatDate(g.createdAt)}</span>
              <span>{formatBytes(g.sizeBytes)}</span>
            </div>
            <audio controls preload="none" src="/api/generations/{g.id}/audio" class="w-100 mt-auto"></audio>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

{#if generationsError}<div class="alert alert-danger py-2 mt-3 mb-0">{generationsError}</div>{/if}
