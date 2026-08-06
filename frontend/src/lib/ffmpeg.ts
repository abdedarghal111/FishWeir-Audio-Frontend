// Conversión de audio a MP3 dentro del propio navegador con ffmpeg.wasm (el
// FFmpeg real compilado a WebAssembly) — así la descarga "comprimida" no
// necesita ningún binario ni dependencia nativa en el backend.
//
// La instancia de FFmpeg se comparte entre todos los reproductores de la
// página (módulo, no por componente): el núcleo wasm (~25-30MB) solo se
// carga una vez, la primera vez que alguien pide un MP3 en la sesión: las
// siguientes conversiones reutilizan la misma instancia ya cargada.
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

let ffmpegPromise: Promise<FFmpeg> | null = null

function loadFfmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg()
      // toBlobURL descarga el core/wasm servidos por Vite y los reempaqueta
      // como blob: URL — lo recomienda la propia documentación de
      // ffmpeg.wasm para evitar problemas de CORS/tipo MIME al cargarlos.
      await ffmpeg.load({
        coreURL: await toBlobURL(coreURL, 'text/javascript'),
        wasmURL: await toBlobURL(wasmURL, 'application/wasm'),
      })
      return ffmpeg
    })()
  }
  return ffmpegPromise
}

/**
 * Convierte el audio al que apunta `src` (URL, blob: URL, o cualquier cosa
 * que acepte fetch) a MP3 y devuelve un Blob listo para descargar.
 *
 * Cada llamada usa nombres únicos dentro del sistema de archivos virtual de
 * ffmpeg.wasm, para poder convertir varios audios a la vez sin que se pisen.
 */
export async function convertToMp3(src: string, bitrateKbps = 192): Promise<Blob> {
  const ffmpeg = await loadFfmpeg()
  const id = crypto.randomUUID()
  const inputName = `${id}.wav`
  const outputName = `${id}.mp3`

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(src))
    await ffmpeg.exec(['-i', inputName, '-codec:a', 'libmp3lame', '-b:a', `${bitrateKbps}k`, outputName])
    const data = await ffmpeg.readFile(outputName)
    // .slice() copia a un ArrayBuffer "normal": el tipo que devuelve
    // ffmpeg.wasm admite venir respaldado por un SharedArrayBuffer, que
    // Blob no acepta directamente.
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data.slice()
    return new Blob([bytes], { type: 'audio/mpeg' })
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {})
    await ffmpeg.deleteFile(outputName).catch(() => {})
  }
}
