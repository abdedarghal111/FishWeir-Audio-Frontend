<!-- Ficha completa de un audio del historial; la tarjeta del listado sólo muestra un resumen. -->
<script lang="ts">
    import { formatBytes, formatDate, type Generation } from './types'
    import AudioPlayer from './AudioPlayer.svelte'

    let {
        generation,
        onClose,
    }: {
        generation: Generation
        onClose: () => void
    } = $props()

    // Sólo se listan los parámetros enviados; el resto se generó con el valor por defecto.
    let params = $derived(
        [
            { label: 'Velocidad', value: generation.speed === undefined ? '' : `${generation.speed}×` },
            { label: 'Volumen', value: generation.volume === undefined ? '' : `${generation.volume} dB` },
            { label: 'Temperature', value: generation.temperature === undefined ? '' : String(generation.temperature) },
            { label: 'Top P', value: generation.topP === undefined ? '' : String(generation.topP) },
            { label: 'Chunk length', value: generation.chunkLength === undefined ? '' : String(generation.chunkLength) },
            { label: 'Normalizar', value: generation.normalize === undefined ? '' : generation.normalize ? 'sí' : 'no' },
            { label: 'Latencia', value: generation.latency ?? '' },
            { label: 'Sample rate', value: generation.sampleRate === undefined ? '' : `${generation.sampleRate} Hz` },
        ].filter((p) => p.value !== ''),
    )

    function closeOnEscape(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            onClose()
        }
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
    aria-label="Detalles del audio generado"
    style="background: rgba(0, 0, 0, 0.5);"
    onclick={onClose}
>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-dialog modal-lg" onclick={(e) => e.stopPropagation()}>
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Audio generado</h5>
                <button type="button" class="btn-close" aria-label="Cerrar" onclick={onClose}></button>
            </div>

            <div class="modal-body">
                <h6 class="text-body-secondary">Texto</h6>
                <p class="full-text">{generation.text}</p>

                <h6 class="text-body-secondary mt-3">Datos</h6>
                <ul class="list-unstyled mb-0 small">
                    <li><i class="fa-solid fa-robot" aria-hidden="true"></i> Modelo: {generation.model}</li>
                    <li><i class="fa-solid fa-microphone" aria-hidden="true"></i> Voz: {generation.voiceTitle ?? 'voz por defecto'}</li>
                    <li><i class="fa-solid fa-clock" aria-hidden="true"></i> Fecha: {formatDate(generation.createdAt)}</li>
                    <li><i class="fa-solid fa-file-audio" aria-hidden="true"></i> Archivo: {formatBytes(generation.sizeBytes)} ({generation.format})</li>
                </ul>

                {#if params.length > 0}
                    <h6 class="text-body-secondary mt-3">Parámetros</h6>
                    <ul class="list-unstyled mb-0 small">
                        {#each params as param (param.label)}
                            <li>{param.label}: {param.value}</li>
                        {/each}
                    </ul>
                {/if}

                <div class="mt-3">
                    <AudioPlayer
                        src="/api/generations/{generation.id}/audio"
                        downloadName="{generation.id}.{generation.format}"
                        compressedName="{generation.id}.mp3"
                    />
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" onclick={onClose}>Cerrar</button>
            </div>
        </div>
    </div>
</div>

<style>
    /* Dentro de la ficha sólo se desplaza el texto; el resto permanece visible. */
    .modal-content {
        max-height: calc(100vh - 3.5rem);
    }

    .modal-body {
        display: flex;
        flex-direction: column;
        /* Sin esto el cuerpo crece con el texto en lugar de repartir el alto disponible. */
        min-height: 0;
        overflow: hidden;
    }

    .modal-body > :global(*:not(.full-text)) {
        flex-shrink: 0;
    }

    .full-text {
        flex: 0 1 auto;
        min-height: 0;
        overflow-y: auto;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
    }
</style>
