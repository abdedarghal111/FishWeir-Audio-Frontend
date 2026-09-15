<script module lang="ts">
    // Persistente: no se reinicia al cambiar de pestaña.
    let generationsError = $state('')
</script>

<script lang="ts">
    // Pestaña "Historial": audios ya generados, a ancho completo (no en columna estrecha).
    import { formatBytes, formatDate, type Generation } from './types'
    import type { PagedResource } from './paged.svelte'
    import AudioPlayer from './AudioPlayer.svelte'
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

                        {#if g.speed !== undefined || g.volume !== undefined || g.temperature !== undefined || g.topP !== undefined || g.chunkLength !== undefined || g.normalize !== undefined || g.latency !== undefined || g.sampleRate !== undefined}
                            <details class="small text-body-secondary mb-2">
                                <summary style="cursor: pointer;"><i class="fa-solid fa-gear" aria-hidden="true"></i> Parámetros</summary>
                                <ul class="mb-0 ps-3">
                                    {#if g.speed !== undefined}<li>Velocidad: {g.speed}×</li>{/if}
                                    {#if g.volume !== undefined}<li>Volumen: {g.volume} dB</li>{/if}
                                    {#if g.temperature !== undefined}<li>Temperature: {g.temperature}</li>{/if}
                                    {#if g.topP !== undefined}<li>Top P: {g.topP}</li>{/if}
                                    {#if g.chunkLength !== undefined}<li>Chunk length: {g.chunkLength}</li>{/if}
                                    {#if g.normalize !== undefined}<li>Normalizar: {g.normalize ? 'sí' : 'no'}</li>{/if}
                                    {#if g.latency !== undefined}<li>Latencia: {g.latency}</li>{/if}
                                    {#if g.sampleRate !== undefined}<li>Sample rate: {g.sampleRate} Hz</li>{/if}
                                </ul>
                            </details>
                        {/if}

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
