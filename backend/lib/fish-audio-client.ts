import { FishAudioClient, FishAudioError, FishAudioTimeoutError } from 'fish-audio'
import type { ModelEntity } from 'fish-audio'
import type { Response } from 'express'

// El tipo `Backends` del SDK está desactualizado y no lista estos modelos,
// pero el SDK reenvía el string tal cual, así que funcionan igual.
export type FishModel = 's1' | 's2-pro' | 's2.1-pro' | 's2.1-pro-free'

const apiKey = process.env.FISH_API_KEY
if (!apiKey) {
  console.warn(
    'Aviso: falta la variable de entorno FISH_API_KEY. Copia .env.example a .env y añade tu ' +
      'API key de https://fish.audio/app/api-keys para poder generar audio, clonar voces y añadir voces ' +
      'compartidas. El resto de la aplicación (favoritos, historial, voces compartidas ya guardadas) funciona igual sin ella.',
  )
}
export const fishAudio = apiKey ? new FishAudioClient({ apiKey }) : null

// `cover_image` y `author.avatar` llegan como rutas relativas al bucket, no URLs completas.
const FISH_CDN_BASE = 'https://public-platform.r2.fish.audio/'

function toAbsoluteImageUrl(pathOrUrl: string): string {
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : FISH_CDN_BASE + pathOrUrl.replace(/^\/+/, '')
}

type VoiceSample = { title: string; text: string; task_id: string; audio: string }

// Sólo viene en la respuesta de crear la voz, no al listarlas ni al obtener una.
export type AudioQuality = {
  filename: string
  duration_ms: number
  language?: string
  quality?: Record<string, number>
  quality_passed?: boolean
  quality_reason?: string
}

// `ModelEntity` tipa `samples` como objeto único y no incluye `quality`, pero la respuesta
// trae un array y el análisis de los audios.
type FishModelEntity = Omit<ModelEntity, 'samples'> & {
  samples?: VoiceSample | VoiceSample[] | null
  quality?: { audios?: AudioQuality[] } | null
}

// El SDK identifica los modelos como `_id`.
export function toVoiceModel(entity: FishModelEntity) {
  const samples = entity.samples ? (Array.isArray(entity.samples) ? entity.samples : [entity.samples]) : []

  return {
    id: entity._id,
    title: entity.title,
    description: entity.description,
    coverImage: entity.cover_image ? toAbsoluteImageUrl(entity.cover_image) : undefined,
    state: entity.state,
    tags: entity.tags,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
    visibility: entity.visibility,
    likeCount: entity.like_count,
    markCount: entity.mark_count,
    sharedCount: entity.shared_count,
    taskCount: entity.task_count,
    author: entity.author && { ...entity.author, avatar: entity.author.avatar ? toAbsoluteImageUrl(entity.author.avatar) : entity.author.avatar },
    trainMode: entity.train_mode,
    languages: entity.languages,
    samples,
    quality: entity.quality?.audios ?? undefined,
  }
}

export type VoiceModel = ReturnType<typeof toVoiceModel>

// Crear y editar voces va por aquí y no por `fishAudio.voices`, que serializa los arrays
// uniéndolos por comas en un solo campo y rompe `tags` y `texts`.
const FISH_API_BASE = 'https://api.fish.audio'

// Sin límite, una petición colgada dejaría el formulario girando para siempre.
const FISH_TIMEOUT_MS = 240_000

function parseBody(text: string): unknown {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// Los fallos se lanzan como `FishAudioError` / `FishAudioTimeoutError` para que
// `sendFishAudioError` los traduzca igual que los del resto de llamadas.
export async function fishAudioFetch(path: string, method: 'POST' | 'PATCH', body: FormData | string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` }
  if (typeof body === 'string') headers['Content-Type'] = 'application/json'

  let res: globalThis.Response
  try {
    res = await fetch(FISH_API_BASE + path, { method, headers, body, signal: AbortSignal.timeout(FISH_TIMEOUT_MS) })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new FishAudioTimeoutError(`Fish Audio no respondió en ${FISH_TIMEOUT_MS / 1000} s.`)
    }
    // Fallo de red o de DNS: sin respuesta, así que no hay código de estado que reenviar.
    throw new FishAudioError({ message: error instanceof Error ? error.message : 'Error de red llamando a Fish Audio.' })
  }

  const parsed = parseBody(await res.text())
  if (!res.ok) throw new FishAudioError({ statusCode: res.status, body: parsed, message: res.statusText })
  return parsed
}

// Mensajes según los códigos documentados en https://docs.fish.audio/api-reference/errors
const FISH_ERROR_MESSAGES: Record<number, string> = {
  400: 'Petición inválida: revisa el texto, el modelo o el reference_id enviados.',
  401: 'La API key de Fish Audio no es válida o falta. Revisa .env.',
  402: 'Sin crédito suficiente en la cuenta de Fish Audio (revisa tu saldo en fish.audio).',
  403: 'Esta API key no tiene permiso para usar ese recurso.',
  404: 'Modelo o voz no encontrado (puede que ya no exista o no sea tuyo).',
  413: 'El archivo es demasiado grande para Fish Audio. Prueba con un audio más corto o expórtalo comprimido (p. ej. MP3 en vez de WAV).',
  422: 'Los datos enviados no son válidos.',
  429: 'Demasiadas peticiones a Fish Audio, espera unos segundos y reintenta.',
}

export function sendFishAudioError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof FishAudioTimeoutError) {
    res.status(504).json({ message: 'Fish Audio no respondió a tiempo, inténtalo de nuevo.' })
    return
  }

  if (error instanceof FishAudioError) {
    const status = error.statusCode ?? 502
    let message = FISH_ERROR_MESSAGES[status] ?? (status >= 500 ? 'Error del servidor de Fish Audio.' : fallbackMessage)

    // Los errores 422 traen { detail: [{ loc, msg }, ...] }; se añade el primero al mensaje.
    const detail = (error.body as { detail?: { loc?: unknown[]; msg?: string }[] } | undefined)?.detail
    if (status === 422 && detail?.[0]) {
      message += ` (${detail[0].loc?.join('.')}: ${detail[0].msg})`
    }

    console.error(`Fish Audio devolvió ${status}:`, error.body ?? error.message)
    res.status(status).json({ message, detail })
    return
  }

  console.error('Error inesperado llamando a Fish Audio:', error)
  res.status(502).json({ message: fallbackMessage })
}

const FISH_AUDIO_UNAVAILABLE_MESSAGE =
  'Fish Audio no está configurado en el backend (falta FISH_API_KEY en .env). ' +
  'No se puede generar audio ni gestionar voces hasta añadir una API key válida.'

// Los endpoints usan esto en vez de `fishAudio` directamente para responder 503 sin API key.
export function requireFishAudio(res: Response): FishAudioClient | null {
  if (!fishAudio) {
    res.status(503).json({ message: FISH_AUDIO_UNAVAILABLE_MESSAGE })
    return null
  }
  return fishAudio
}
