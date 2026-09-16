<!-- Aviso de que hay publicada una versión más nueva que la instalada. La consulta a GitHub
     y su caché están en el backend. -->
<script lang="ts">
    import { loadPersisted, savePersisted, type UpdateStatus } from './types'

    const CHECK_INTERVAL_MS = 15 * 60 * 1000

    let update = $state<UpdateStatus | null>(null)

    // Versión ya descartada por el usuario; si se publica otra, vuelve a avisar.
    let dismissedVersion = $state(loadPersisted<string>('dismissedUpdateVersion', ''))

    async function check() {
        try {
            const res = await fetch('/api/update')
            update = res.ok ? await res.json() : null
        } catch {
            // El aviso es secundario: un fallo no se muestra como error.
            update = null
        }
    }

    function dismiss() {
        dismissedVersion = update?.latestVersion ?? ''
        savePersisted('dismissedUpdateVersion', dismissedVersion)
    }

    $effect(() => {
        check()
        const timer = setInterval(() => check(), CHECK_INTERVAL_MS)
        return () => clearInterval(timer)
    })

    let visible = $derived(update?.status === 'update-available' && update.latestVersion !== dismissedVersion)
    // Los tags llevan "v" delante y package.json no: en el texto se enseñan sin ella.
    let latestLabel = $derived(update?.latestVersion?.replace(/^v/, '') ?? '')
    // Avanza sólo hasta el tag publicado; --ff-only evita crear un merge si la copia está tocada.
    let updateCommand = $derived(`git fetch --tags && git merge --ff-only ${update?.latestVersion ?? ''}`)
</script>

{#if visible && update}
    <div class="alert alert-warning d-flex align-items-center gap-2 py-2" role="status">
        <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
        <span class="flex-grow-1">
            Hay una versión nueva publicada: {latestLabel} (tienes {update.currentVersion}).
            Actualiza con <code>{updateCommand}</code>, cierra y vuelve a abrir la aplicación.
            {#if update.releaseUrl}
                <a href={update.releaseUrl} target="_blank" rel="noreferrer">Ver novedades de versión</a>
            {/if}
        </span>
        <button type="button" class="btn-close" aria-label="Ocultar el aviso" onclick={dismiss}></button>
    </div>
{:else if update?.status === 'unknown'}
    <div class="alert alert-secondary d-flex align-items-center gap-2 py-2 small" role="status">
        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
        <span class="flex-grow-1" title={update.reason}>
            No se ha podido comprobar si hay una versión nueva porque GitHub no ha respondido. No es un fallo de la
            aplicación ni afecta a nada de lo que hagas aquí.
        </span>
    </div>
{/if}
