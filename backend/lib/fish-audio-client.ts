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

// El SDK identifica los modelos como `_id`.
export function toVoiceModel(entity: ModelEntity) {
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
    samples: entity.samples,
  }
}

export type VoiceModel = ReturnType<typeof toVoiceModel>

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
