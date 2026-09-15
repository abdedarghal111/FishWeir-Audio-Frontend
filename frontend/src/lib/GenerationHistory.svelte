<!-- Pestaña "Historial": los audios ya generados, paginados y a ancho completo, con acceso a la
     ficha de cada uno. -->
<script module lang="ts">
    // Persistente: no se reinicia al cambiar de pestaña.
    let generationsError = $state('')
</script>

<script lang="ts">
    import { formatBytes, formatDate, type Generation } from './types'
    import type { PagedResource } from './paged.svelte'
    import AudioPlayer from './AudioPlayer.svelte'
    import GenerationDetailsModal from './GenerationDetailsModal.svelte'
    import Pagination from './Pagination.svelte'

    let {
        generationsPage,
        onDeleteGeneration,
    }: {
        // Sólo llegan los audios de la página actual; cada uno monta su propio reproductor.
        generationsPage: PagedResource<Generation>
        onDeleteGeneration: (id: string) => Promise<void>
    } = $props()

    let generations = $derived(generationsPage.items)

    // Audio cuya ficha completa se está viendo; `undefined` = modal cerrado.
    let detailed: Generation | undefined = $state(undefined)

    async function deleteGeneration(id: string) {
        try {
            await onDeleteGeneration(id)
        } catch (err) {
            generationsError = err instanceof Error ? err.message : 'Error eliminando la generación'
        }
    }
</script>

<h2 class="h5 mb-3">Audios generados</h2>

<input
    type="search"
    class="form-control form-control-sm mb-3"
    bind:value={generationsPage.search}
    placeholder="Buscar por texto, voz o modelo..."
/>

<!-- La misma barra se muestra encima y debajo de la rejilla. -->
{#snippet pager()}
    <Pagination
        page={generationsPage.page}
        pageCount={generationsPage.pageCount}
        total={generationsPage.total}
        pageSize={generationsPage.pageSize}
        loading={generationsPage.loading}
        label="audios"
        onPage={(p) => generationsPage.setPage(p)}
        onPageSize={(size) => generationsPage.setPageSize(size)}
    />
{/snippet}

{@render pager()}

{#if generations.length === 0}
    <p class="text-body-secondary">
        {#if generationsPage.search.trim()}
            Ningún audio coincide con "{generationsPage.search}".
        {:else}
            Todavía no has generado ningún audio.
        {/if}
    </p>
{:else}
    <div class="row g-3">
        {#each generations as g (g.id)}
            <div class="col-md-6 col-lg-4">
                <div class="card h-100">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <!-- El resumen completo abre la ficha del audio. -->
                            <button
                                type="button"
                                class="record flex-grow-1 text-start"
                                title="Ver la ficha completa"
                                onclick={() => (detailed = g)}
                            >
                                <span class="prompt mb-1">{g.text}</span>
                                <span class="d-flex flex-wrap gap-2 small text-body-secondary">
                                    <span><i class="fa-solid fa-robot" aria-hidden="true"></i> {g.model}</span>
                                    <span><i class="fa-solid fa-microphone" aria-hidden="true"></i> {g.voiceTitle ?? 'voz por defecto'}</span>
                                    <span>{formatDate(g.createdAt)}</span>
                                    <span>{formatBytes(g.sizeBytes)}</span>
                                </span>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger flex-shrink-0" onclick={() => deleteGeneration(g.id)}>
                                <i class="fa-solid fa-trash" aria-hidden="true"></i> Eliminar
                            </button>
                        </div>

                        <div class="mt-auto">
                            <AudioPlayer
                                src="/api/generations/{g.id}/audio"
                                downloadName="{g.id}.{g.format}"
                                compressedName="{g.id}.mp3"
                            />
                        </div>
                    </div>
                </div>
            </div>
        {/each}
    </div>
{/if}

{@render pager()}

{#if generationsError}<div class="alert alert-danger py-2 mt-3 mb-0">{generationsError}</div>{/if}

{#if detailed}
    <GenerationDetailsModal generation={detailed} onClose={() => (detailed = undefined)} />
{/if}

<style>
    /* Botón sin apariencia de botón: el resumen debe seguir leyéndose como parte de la tarjeta. */
    .record {
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        min-width: 0;
        border-radius: var(--bs-border-radius);
        /* El margen negativo compensa el relleno: el resaltado no desplaza el contenido. */
        padding: 0.25rem 0.5rem;
        margin: -0.25rem -0.5rem;
        transition: background-color 0.15s ease-in-out;
    }

    .record:hover,
    .record:focus-visible {
        background-color: var(--bs-secondary-bg);
    }

    /* Altura fija de tres líneas para igualar las tarjetas; el resto del texto está en la ficha. */
    .prompt {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        line-height: 1.4;
        height: calc(3 * 1.4em);
        overflow: hidden;
        overflow-wrap: anywhere;
    }
</style>
