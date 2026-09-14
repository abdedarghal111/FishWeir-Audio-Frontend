<script lang="ts">
    // Reproductor propio (en vez del <audio controls> nativo) con botones de descarga
    // normal (WAV) y comprimida (MP3 via ffmpeg.wasm, ver ./ffmpeg.ts).
    import { convertToMp3 } from './ffmpeg'

    let {
        src,
        downloadName = 'audio.wav',
        compressedName = 'audio.mp3',
        currentTime = $bindable(0),
        duration = $bindable(0),
        volume = $bindable(1),
        paused = $bindable(true),
    }: {
        src: string
        downloadName?: string
        compressedName?: string
        // Opcionales: pasados con bind:, sobreviven al desmontaje del reproductor.
        currentTime?: number
        duration?: number
        volume?: number
        // Asignarlo reproduce/pausa solo; es prop para poder montarlo ya sonando.
        paused?: boolean
    } = $props()

    // El <audio> nuevo arranca en 0 y no sabe la duración hasta cargar los metadatos.
    const startTime = currentTime
    const startDuration = duration

    function restorePosition(e: Event) {
        if (startTime > 0) (e.currentTarget as HTMLAudioElement).currentTime = startTime
    }

    let totalTime = $derived(duration > 0 ? duration : startDuration)
    // Fracción, con el max del slider fijo a 1: con un max que arranca en 0 el navegador recorta
    // el value y el pulgar se queda a la izquierda.
    let progress = $derived(totalTime > 0 ? currentTime / totalTime : 0)

    function seek(e: Event) {
        currentTime = (e.currentTarget as HTMLInputElement).valueAsNumber * totalTime
    }

    function formatTime(t: number) {
        if (!isFinite(t) || t < 0) return '0:00'
        const m = Math.floor(t / 60)
        const s = Math.floor(t % 60)
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    function triggerDownload(url: string, name: string) {
        const a = document.createElement('a')
        a.href = url
        a.download = name
        a.click()
    }

    let convertingMp3 = $state(false)
    let mp3Error = $state('')

    async function downloadCompressed() {
        convertingMp3 = true
        mp3Error = ''
        try {
            const blob = await convertToMp3(src)
            const url = URL.createObjectURL(blob)
            triggerDownload(url, compressedName)
            URL.revokeObjectURL(url)
        } catch (err) {
            mp3Error = err instanceof Error ? err.message : 'No se ha podido comprimir el audio'
        } finally {
            convertingMp3 = false
        }
    }
</script>

<div class="audio-player d-flex align-items-center gap-2 flex-wrap">
    <button
        type="button"
        class="btn btn-sm btn-primary play-btn"
        onclick={() => (paused = !paused)}
        aria-label={paused ? 'Reproducir' : 'Pausar'}
    >
        <i class="fa-solid {paused ? 'fa-play' : 'fa-pause'}" aria-hidden="true"></i>
    </button>

    <span class="small text-body-secondary time">{formatTime(currentTime)}</span>
    <input type="range" class="form-range flex-grow-1" min="0" max="1" step="0.001" value={progress} oninput={seek} aria-label="Progreso" />
    <span class="small text-body-secondary time">{formatTime(totalTime)}</span>

    <i class="fa-solid fa-volume-high text-body-secondary" aria-hidden="true"></i>
    <input type="range" class="form-range volume" min="0" max="1" step="0.05" bind:value={volume} title="Volumen" aria-label="Volumen" />

    <div class="d-flex gap-1">
        <a class="btn btn-sm btn-outline-secondary" href={src} download={downloadName} title="Descargar (calidad original)">
            <i class="fa-solid fa-download" aria-hidden="true"></i> Original
        </a>
        <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            title="Descargar comprimido (MP3)"
            onclick={downloadCompressed}
            disabled={convertingMp3}
        >
            {#if convertingMp3}
                <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Comprimiendo...
            {:else}
                <i class="fa-solid fa-file-zipper" aria-hidden="true"></i> MP3
            {/if}
        </button>
    </div>
</div>

{#if mp3Error}<div class="alert alert-danger py-1 px-2 small mt-1 mb-0">{mp3Error}</div>{/if}

<audio bind:paused bind:currentTime bind:duration bind:volume {src} preload="metadata" onloadedmetadata={restorePosition} hidden></audio>

<style>
    .play-btn {
        width: 2rem;
        height: 2rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        line-height: 1;
        border-radius: 50%;
        flex-shrink: 0;
    }
    .time {
        width: 2.6rem;
        text-align: center;
        flex-shrink: 0;
    }
    .volume {
        max-width: 4.5rem;
        flex-shrink: 0;
    }
</style>
