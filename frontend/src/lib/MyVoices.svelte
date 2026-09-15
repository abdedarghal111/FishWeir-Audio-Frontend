<script lang="ts">
    // Pestaña "Mis voces": la lista de voces clonadas. Clonar una nueva abre un modal, para no
    // tapar la lista con un formulario largo que casi siempre está sin usar.
    import type { Favorite, NewVoice, SelectedVoice, Voice, VoiceEdit } from './types'
    import type { PagedResource } from './paged.svelte'
    import CloneVoiceModal, { hasDraft } from './CloneVoiceModal.svelte'
    import ConfirmModal from './ConfirmModal.svelte'
    import EditVoiceModal from './EditVoiceModal.svelte'
    import Pagination from './Pagination.svelte'
    import VoiceCard from './VoiceCard.svelte'

    let {
        voicesPage,
        fishAvailable,
        selectedVoice = $bindable(null),
        isFavorite,
        onToggleFavorite,
        onCreateVoice,
        onUpdateVoice,
        onDeleteVoice,
    }: {
        // La búsqueda y la página las resuelve Fish Audio a través del backend.
        voicesPage: PagedResource<Voice>
        // Si es `false`, falta FISH_API_KEY en el backend: no se pueden clonar ni listar voces.
        fishAvailable: boolean
        selectedVoice: SelectedVoice | null
        isFavorite: (type: Favorite['type'], id: string) => boolean
        onToggleFavorite: (type: Favorite['type'], id: string, label: string) => void
        onCreateVoice: (voice: NewVoice) => Promise<Voice>
        onUpdateVoice: (id: string, edit: VoiceEdit) => Promise<void>
        onDeleteVoice: (id: string) => Promise<void>
    } = $props()

    let voices = $derived(voicesPage.items)

    // Voz que se está editando / borrando; `undefined` = ese modal está cerrado.
    let editing: Voice | undefined = $state(undefined)
    let deleting: Voice | undefined = $state(undefined)
    let cloning = $state(false)

    // El formulario de clonación conserva lo escrito aunque se cierre el modal; esto avisa de
    // que hay algo a medias sin necesidad de abrirlo.
    let draft = $derived(hasDraft())
</script>

{#if !fishAvailable}
    <div class="alert alert-warning d-flex align-items-start gap-2">
        <i class="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true"></i>
        <span>
            No se pueden clonar ni listar voces: falta configurar la API key de Fish Audio en el servidor
            (<code>FISH_API_KEY</code> en <code>.env</code>). El resto de la aplicación funciona con normalidad.
        </span>
    </div>
{:else}
    <section>
        <h3 class="h5">Tus voces clonadas</h3>

        <input
            type="search"
            class="form-control form-control-sm mb-3"
            bind:value={voicesPage.search}
            placeholder="Buscar por título..."
        />

        <!-- La misma barra se muestra encima y debajo del listado. -->
        {#snippet pager()}
            <Pagination
                page={voicesPage.page}
                pageCount={voicesPage.pageCount}
                total={voicesPage.total}
                pageSize={voicesPage.pageSize}
                loading={voicesPage.loading}
                label="voces"
                onPage={(p) => voicesPage.setPage(p)}
                onPageSize={(size) => voicesPage.setPageSize(size)}
            />
        {/snippet}

        {@render pager()}

        <div class="d-flex flex-column gap-3">
            <!-- Hueco con aspecto de tarjeta vacía que abre el formulario de clonación. -->
            <button type="button" class="new-voice card w-100 text-start" onclick={() => (cloning = true)}>
                <div class="card-body d-flex align-items-center gap-3">
                    <span class="icon rounded d-flex align-items-center justify-content-center flex-shrink-0">
                        <i class="fa-solid fa-plus" aria-hidden="true"></i>
                    </span>
                    <span class="flex-grow-1">
                        <span class="d-block fw-semibold">Crear voz clonada nueva</span>
                        <span class="d-block text-body-secondary small">
                            {#if draft}
                                Tienes un borrador a medias: se conserva tal y como lo dejaste.
                            {:else}
                                Sube uno o varios audios de referencia y Fish Audio la clona en un minuto.
                            {/if}
                        </span>
                    </span>
                    {#if draft}<span class="badge text-bg-warning flex-shrink-0">Borrador</span>{/if}
                </div>
            </button>

            {#if voices.length === 0}
                <p class="text-body-secondary mb-0">
                    {#if voicesPage.search.trim()}
                        Ninguna voz coincide con "{voicesPage.search}".
                    {:else}
                        Todavía no tienes ninguna voz clonada.
                    {/if}
                </p>
            {/if}

            {#each voices as voice (voice.id)}
                <VoiceCard
                    {voice}
                    favorite={isFavorite('voice', voice.id)}
                    onToggleFavorite={() => onToggleFavorite('voice', voice.id, voice.title)}
                    onSelect={() => (selectedVoice = { id: voice.id, title: voice.title, coverImage: voice.coverImage })}
                    selected={selectedVoice?.id === voice.id}
                    onEdit={() => (editing = voice)}
                    onRemove={() => (deleting = voice)}
                    removeLabel="Eliminar"
                />
            {/each}
        </div>

        {@render pager()}
    </section>

    {#if cloning}
        <CloneVoiceModal {onCreateVoice} onClose={() => (cloning = false)} />
    {/if}

    {#if editing}
        <EditVoiceModal
            voice={editing}
            onSave={(edit) => onUpdateVoice(editing!.id, edit)}
            onClose={() => (editing = undefined)}
        />
    {/if}

    {#if deleting}
        <ConfirmModal
            title="Eliminar voz"
            confirmLabel="Eliminar"
            danger
            onConfirm={() => onDeleteVoice(deleting!.id)}
            onClose={() => (deleting = undefined)}
        >
            <p class="mb-2">
                Se va a eliminar <strong>{deleting.title}</strong> de tu cuenta de Fish Audio.
            </p>
            <p class="mb-0 text-body-secondary small">
                No se puede deshacer, y los audios de referencia no se recuperan: para volver a tenerla habría que clonarla de
                nuevo. Las generaciones que ya hiciste con ella se conservan en el historial.
            </p>
        </ConfirmModal>
    {/if}
{/if}

<style>
    /* Botón con forma de tarjeta, para que encaje con las voces de la lista. */
    .new-voice {
        border: 2px dashed var(--bs-border-color);
        background: transparent;
        cursor: pointer;
    }

    .new-voice:hover,
    .new-voice:focus-visible {
        border-color: var(--bs-primary);
        background: var(--bs-primary-bg-subtle);
    }

    .new-voice .icon {
        width: 4.5rem;
        height: 4.5rem;
        border: 2px dashed var(--bs-border-color);
        color: var(--bs-secondary-color);
    }

    .new-voice:hover .icon,
    .new-voice:focus-visible .icon {
        border-color: var(--bs-primary);
        color: var(--bs-primary);
    }
</style>
