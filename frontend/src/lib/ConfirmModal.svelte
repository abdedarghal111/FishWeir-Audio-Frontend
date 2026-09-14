<script lang="ts">
    // Confirmación para acciones que no se pueden deshacer (borrar una voz, por ejemplo).
    let {
        title,
        confirmLabel = 'Confirmar',
        danger = false,
        onConfirm,
        onClose,
        children,
    }: {
        title: string
        confirmLabel?: string
        // Pinta el botón de confirmar en rojo: para acciones destructivas.
        danger?: boolean
        onConfirm: () => Promise<void>
        onClose: () => void
        children: import('svelte').Snippet
    } = $props()

    let loading = $state(false)
    let error = $state('')

    async function confirm() {
        loading = true
        error = ''
        try {
            await onConfirm()
            onClose()
        } catch (err) {
            error = err instanceof Error ? err.message : 'No se ha podido completar la acción'
        } finally {
            loading = false
        }
    }

    function close() {
        // Mientras la acción está en curso cerrar dejaría al usuario sin saber en qué quedó.
        if (!loading) onClose()
    }

    function closeOnEscape(e: KeyboardEvent) {
        if (e.key === 'Escape') close()
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
    aria-label={title}
    style="background: rgba(0, 0, 0, 0.5);"
    onclick={close}
>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-dialog" onclick={(e) => e.stopPropagation()}>
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">{title}</h5>
                <button type="button" class="btn-close" aria-label="Cerrar" onclick={close} disabled={loading}></button>
            </div>

            <div class="modal-body">
                {@render children()}
                {#if error}<div class="alert alert-danger py-2 mt-3 mb-0">{error}</div>{/if}
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" onclick={close} disabled={loading}>Cancelar</button>
                <button type="button" class="btn" class:btn-danger={danger} class:btn-primary={!danger} onclick={confirm} disabled={loading}>
                    {#if loading}<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>{/if}
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
</div>
