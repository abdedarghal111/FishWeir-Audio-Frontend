<script lang="ts">
    // Raíz: capa de datos y pestañas; la interfaz de cada sección vive en lib/*.svelte
    // (TextPanel = Generar, MyVoices = Mis voces, SharedVoices = Compartidas, GenerationHistory = Historial).
    import GenerationHistory from './lib/GenerationHistory.svelte'
    import MyVoices from './lib/MyVoices.svelte'
    import SharedVoices from './lib/SharedVoices.svelte'
    import TextPanel from './lib/TextPanel.svelte'
    import UpdateBanner from './lib/UpdateBanner.svelte'
    import { registerSpend } from './lib/WalletBar.svelte'
    import { createPagedResource } from './lib/paged.svelte'
    import {
        errorMessage,
        loadPersisted,
        savePersisted,
        type Favorite,
        type Generation,
        type NewVoice,
        type SelectedVoice,
        type Voice,
        type VoiceEdit,
    } from './lib/types'

    let tab: 'generar' | 'mis-voces' | 'compartidas' | 'historial' = $state('generar')

    // Los toasts se gestionan aquí, no en cada formulario, para que sigan visibles si el
    // usuario cambia de pestaña antes de que termine una petición y el formulario se desmonte.
    let toasts: { id: string; message: string }[] = $state([])

    function notifyError(message: string) {
        const id = crypto.randomUUID()
        toasts = [...toasts, { id, message }]
        setTimeout(() => dismissToast(id), 10000)
    }

    function dismissToast(id: string) {
        toasts = toasts.filter((t) => t.id !== id)
    }

    // Se guarda la voz entera, no sólo su ID: ya no hay un listado completo en memoria donde
    // consultar su título y su imagen.
    let selectedVoice: SelectedVoice | null = $state(loadPersisted<SelectedVoice | null>('selectedVoice', null))
    $effect(() => savePersisted('selectedVoice', selectedVoice))

    // Generar audio, clonar voces y añadir voces compartidas requieren FISH_API_KEY en el
    // backend; si falta, esos formularios se deshabilitan (el resto sigue funcionando).
    let fishAvailable = $state(true)

    // Los tres listados piden al backend sólo la página que se está mostrando.
    const voicesPage = createPagedResource<Voice>('/api/voices', {
        onError: (message) => notifyError(message),
    })

    async function init() {
        try {
            const res = await fetch('/api/fish-audio/status')
            const data = res.ok ? await res.json() : { available: false }
            fishAvailable = Boolean(data?.available)
        } catch {
            fishAvailable = false
        }

        if (!fishAvailable) {
            voicesPage.clear()
            return
        }
        await voicesPage.load()
    }
    init()

    // Si la recarga falla, la operación previa ya se completó: el recurso avisa y no se propaga.
    async function refreshVoices() {
        await voicesPage.load()
    }

    async function createVoiceApi(voice: NewVoice): Promise<Voice> {
        try {
            const form = new FormData()
            form.set('title', voice.title)
            for (const file of voice.files) form.append('voices', file)
            // Una entrada por audio aunque esté vacía: el backend sólo las envía si están todas.
            for (const text of voice.texts) form.append('texts', text)
            for (const tag of voice.tags) form.append('tags', tag)
            form.set('description', voice.description)
            form.set('visibility', voice.visibility)
            form.set('enhance_audio_quality', String(voice.enhanceAudioQuality))
            form.set('generate_sample', String(voice.generateSample))
            if (voice.coverImage) form.set('cover_image', voice.coverImage)

            const res = await fetch('/api/voices', { method: 'POST', body: form })
            if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
            const created: Voice = await res.json()
            // Sin await: puede reintentar durante varios segundos.
            registerSpend()
            await refreshVoices()
            // Se devuelve la voz creada para poder mostrar el análisis de calidad de los audios,
            // que sólo viene en esta respuesta y no al listar.
            return created
        } catch (err) {
            notifyError(err instanceof Error ? err.message : 'Error creando la voz')
            throw err
        }
    }

    async function updateVoiceApi(id: string, edit: VoiceEdit) {
        try {
            const form = new FormData()
            form.set('title', edit.title)
            form.set('description', edit.description)
            form.set('visibility', edit.visibility)
            for (const tag of edit.tags) form.append('tags', tag)
            if (edit.coverImage) form.set('cover_image', edit.coverImage)

            const res = await fetch(`/api/voices/${id}`, { method: 'PATCH', body: form })
            if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
            await refreshVoices()
        } catch (err) {
            notifyError(err instanceof Error ? err.message : 'Error actualizando la voz')
            throw err
        }
    }

    async function deleteVoiceApi(id: string) {
        try {
            const res = await fetch(`/api/voices/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
            await refreshVoices()
        } catch (err) {
            notifyError(err instanceof Error ? err.message : 'Error eliminando la voz')
            throw err
        }
    }

    const sharedVoicesPage = createPagedResource<Voice>('/api/shared-voices', {
        onError: (message) => notifyError(message),
    })
    sharedVoicesPage.load()

    async function addSharedVoiceApi(input: string) {
        try {
            const res = await fetch('/api/shared-voices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input }),
            })
            if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
            await sharedVoicesPage.load()
        } catch (err) {
            notifyError(err instanceof Error ? err.message : 'Error añadiendo la voz compartida')
            throw err
        }
    }

    async function removeSharedVoiceApi(id: string) {
        try {
            const res = await fetch(`/api/shared-voices/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
            await sharedVoicesPage.load()
        } catch (err) {
            notifyError(err instanceof Error ? err.message : 'Error quitando la voz compartida')
            throw err
        }
    }

    let favorites: Favorite[] = $state([])

    async function loadFavorites() {
        const res = await fetch('/api/favorites')
        if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
        favorites = await res.json()
    }
    loadFavorites().catch((err) => {
        favorites = []
        notifyError(err instanceof Error ? err.message : 'No se han podido cargar los favoritos')
    })

    function isFavorite(type: Favorite['type'], id: string) {
        return id !== '' && favorites.some((f) => f.type === type && f.id === id)
    }

    async function toggleFavorite(type: Favorite['type'], id: string, label: string) {
        if (!id) return
        try {
            if (isFavorite(type, id)) {
                const res = await fetch(`/api/favorites/${encodeURIComponent(`${type}:${id}`)}`, { method: 'DELETE' })
                if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
                favorites = await res.json()
            } else {
                const res = await fetch('/api/favorites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, id, label }),
                })
                if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
                favorites = await res.json()
            }
        } catch (err) {
            notifyError(err instanceof Error ? err.message : 'Error actualizando favoritos')
        }
    }

    const generationsPage = createPagedResource<Generation>('/api/generations', {
        onError: (message) => notifyError(message),
    })
    generationsPage.load()

    // El audio nuevo encabeza el historial, así que se vuelve a la primera página.
    function onGenerated() {
        generationsPage.setPage(1)
    }

    async function deleteGenerationApi(id: string) {
        try {
            const res = await fetch(`/api/generations/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error(await errorMessage(res, `Error ${res.status}`))
            await generationsPage.load()
        } catch (err) {
            notifyError(err instanceof Error ? err.message : 'Error eliminando la generación')
            throw err
        }
    }
</script>

<main class="container py-4">
    <h1 class="mb-4">FishWeir Audio Frontend</h1>

    <UpdateBanner />

    <ul class="nav nav-tabs mb-4">
        <li class="nav-item">
            <button type="button" class="nav-link" class:active={tab === 'generar'} onclick={() => (tab = 'generar')}>
                Generar
            </button>
        </li>
        <li class="nav-item">
            <button type="button" class="nav-link" class:active={tab === 'mis-voces'} onclick={() => (tab = 'mis-voces')}>
                Mis voces
            </button>
        </li>
        <li class="nav-item">
            <button type="button" class="nav-link" class:active={tab === 'compartidas'} onclick={() => (tab = 'compartidas')}>
                Voces compartidas
            </button>
        </li>
        <li class="nav-item">
            <button type="button" class="nav-link" class:active={tab === 'historial'} onclick={() => (tab = 'historial')}>
                Historial
            </button>
        </li>
    </ul>

    {#if tab === 'generar'}
        <TextPanel
            {favorites}
            {fishAvailable}
            bind:selectedVoice
            {isFavorite}
            onToggleFavorite={toggleFavorite}
            {onGenerated}
            onError={notifyError}
        />
    {:else if tab === 'mis-voces'}
        <MyVoices
            {voicesPage}
            {fishAvailable}
            bind:selectedVoice
            {isFavorite}
            onToggleFavorite={toggleFavorite}
            onCreateVoice={createVoiceApi}
            onUpdateVoice={updateVoiceApi}
            onDeleteVoice={deleteVoiceApi}
        />
    {:else if tab === 'compartidas'}
        <SharedVoices
            {sharedVoicesPage}
            {fishAvailable}
            bind:selectedVoice
            {isFavorite}
            onToggleFavorite={toggleFavorite}
            onAddSharedVoice={addSharedVoiceApi}
            onRemoveSharedVoice={removeSharedVoiceApi}
        />
    {:else}
        <GenerationHistory {generationsPage} onDeleteGeneration={deleteGenerationApi} />
    {/if}
</main>

<div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 2000;">
    {#each toasts as t (t.id)}
        <div class="alert alert-danger d-flex align-items-start gap-2 shadow-sm mb-2" role="alert">
            <span class="flex-grow-1">{t.message}</span>
            <button type="button" class="btn-close" aria-label="Cerrar" onclick={() => dismissToast(t.id)}></button>
        </div>
    {/each}
</div>
