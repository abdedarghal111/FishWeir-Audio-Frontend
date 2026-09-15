<script lang="ts">
    // Lista compacta (foto + nombre + filtro) para elegir voz en la pestaña "Generar";
    // el resto de datos/acciones viven en sus propias pestañas.
    import type { SelectedVoice, Voice } from './types'
    import { createPagedResource } from './paged.svelte'
    import Pagination from './Pagination.svelte'

    let {
        fishAvailable = true,
        selectedVoice = $bindable(null),
        onSelect,
    }: {
        // Sin API key no hay listado de voces propias: se evita la petición y el error.
        fishAvailable?: boolean
        selectedVoice: SelectedVoice | null
        // Se llama tras elegir voz, además de fijar la selección (p. ej. para cerrar un modal).
        onSelect?: () => void
    } = $props()

    // Propias y compartidas se paginan por separado: son dos listados distintos del backend.
    const PICKER_PAGE_SIZE = 8

    const mine = createPagedResource<Voice>('/api/voices', { pageSize: PICKER_PAGE_SIZE })
    const shared = createPagedResource<Voice>('/api/shared-voices', { pageSize: PICKER_PAGE_SIZE })

    let source: 'mine' | 'shared' = $state('mine')
    let current = $derived(source === 'mine' ? mine : shared)

    // Cada listado se consulta la primera vez que se muestra, no al montar el componente.
    let loaded = { mine: false, shared: false }

    function show(next: 'mine' | 'shared') {
        source = next
        if (loaded[next] || (next === 'mine' && !fishAvailable)) {
            return
        }
        loaded[next] = true
        const resource = next === 'mine' ? mine : shared
        resource.load()
    }

    // Sin API key no hay voces propias que listar, así que se abre en las compartidas.
    // svelte-ignore state_referenced_locally
    show(fishAvailable ? 'mine' : 'shared')

    function pick(voice?: Voice) {
        selectedVoice = voice ? { id: voice.id, title: voice.title, coverImage: voice.coverImage } : null
        onSelect?.()
    }
</script>

<h3 class="h6">Voz clonada</h3>

<div class="btn-group btn-group-sm mb-2" role="group" aria-label="Origen de las voces">
    <button
        type="button"
        class="btn"
        class:btn-primary={source === 'mine'}
        class:btn-outline-secondary={source !== 'mine'}
        onclick={() => show('mine')}
    >
        Mis voces
    </button>
    <button
        type="button"
        class="btn"
        class:btn-primary={source === 'shared'}
        class:btn-outline-secondary={source !== 'shared'}
        onclick={() => show('shared')}
    >
        Compartidas
    </button>
</div>

<input type="search" class="form-control mb-2" bind:value={current.search} placeholder="Filtrar voces..." />

<button
    type="button"
    class="btn text-start w-100 mb-2"
    class:btn-primary={selectedVoice === null}
    class:btn-outline-secondary={selectedVoice !== null}
    onclick={() => pick()}
>
    Voz por defecto del modelo
</button>

<!-- La misma barra se muestra encima y debajo del listado. -->
{#snippet pager()}
    <Pagination
        page={current.page}
        pageCount={current.pageCount}
        total={current.total}
        pageSize={current.pageSize}
        loading={current.loading}
        label="voces"
        onPage={(p) => current.setPage(p)}
    />
{/snippet}

{@render pager()}

{#if source === 'mine' && !fishAvailable}
    <p class="text-body-secondary mb-0">
        No se pueden listar tus voces: falta configurar <code>FISH_API_KEY</code> en el servidor.
    </p>
{:else if current.items.length === 0}
    <p class="text-body-secondary mb-0">
        {#if current.search.trim()}
            Ninguna voz coincide con "{current.search}".
        {:else}
            No hay voces en esta lista.
        {/if}
    </p>
{:else}
    <div class="row g-2">
        {#each current.items as voice (voice.id)}
            <div class="col-6">
                <button
                    type="button"
                    class="btn text-start d-flex align-items-center gap-2 w-100"
                    class:btn-primary={selectedVoice?.id === voice.id}
                    class:btn-outline-secondary={selectedVoice?.id !== voice.id}
                    onclick={() => pick(voice)}
                >
                    {#if voice.coverImage}
                        <img src={voice.coverImage} alt="" class="rounded object-fit-cover flex-shrink-0" style="width: 2.25rem; height: 2.25rem;" />
                    {:else}
                        <span class="rounded bg-secondary-subtle flex-shrink-0" style="width: 2.25rem; height: 2.25rem;"></span>
                    {/if}
                    <span class="text-truncate">{voice.title}</span>
                </button>
            </div>
        {/each}
    </div>
{/if}

{@render pager()}
