// Backend mínimo: un solo archivo con todo (cliente de Fish Audio + rutas +
// servir el frontend). La API key SOLO vive aquí, nunca llega al navegador.
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import express from 'express'
import multer from 'multer'
import { FishAudioClient, FishAudioError, FishAudioTimeoutError } from 'fish-audio'
import type { ModelEntity, Backends } from 'fish-audio'
import type { Response } from 'express'

// El tipo `Backends` del SDK está desactualizado (es de una versión anterior de
// la API) y no incluye los modelos reales de Fish Audio. Por dentro el SDK solo
// reenvía este valor tal cual como el header HTTP `model`, así que los nombres
// reales (documentados en la API) funcionan igual aunque el tipo no los liste.
type FishModel = 's1' | 's2-pro' | 's2.1-pro' | 's2.1-pro-free'

const PORT = Number(process.env.PORT) || 4000

const apiKey = process.env.FISH_API_KEY
if (!apiKey) {
  throw new Error(
    'Falta la variable de entorno FISH_API_KEY. Copia backend/.env.example a backend/.env ' +
      'y añade tu API key de https://fish.audio/app/api-keys',
  )
}
const fishAudio = new FishAudioClient({ apiKey })

// `cover_image` y `author.avatar` llegan como rutas relativas dentro del bucket
// de Fish Audio (p.ej. "coverimage/<id>" o "avatars/<archivo>.png"), no como
// URLs completas — hay que anteponerles el dominio de su CDN para que carguen.
const FISH_CDN_BASE = 'https://public-platform.r2.fish.audio/'

function toAbsoluteImageUrl(pathOrUrl: string): string {
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : FISH_CDN_BASE + pathOrUrl.replace(/^\/+/, '')
}

// El SDK identifica los modelos como `_id`. Se reenvía toda la info que la
// propia web de Fish Audio muestra para una voz (descripción, portada, tags,
// visibilidad, contadores de likes/marks/shares/tasks, autor, modo de
// entrenamiento, idiomas y muestras de entrenamiento), no solo lo mínimo.
function toVoiceModel(entity: ModelEntity) {
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

// Mensajes según los códigos documentados en https://docs.fish.audio/api-reference/errors
const FISH_ERROR_MESSAGES: Record<number, string> = {
  400: 'Petición inválida: revisa el texto, el modelo o el reference_id enviados.',
  401: 'La API key de Fish Audio no es válida o falta. Revisa backend/.env.',
  402: 'Sin crédito suficiente en la cuenta de Fish Audio (revisa tu saldo en fish.audio).',
  403: 'Esta API key no tiene permiso para usar ese recurso.',
  404: 'Modelo o voz no encontrado (puede que ya no exista o no sea tuyo).',
  422: 'Los datos enviados no son válidos.',
  429: 'Demasiadas peticiones a Fish Audio, espera unos segundos y reintenta.',
}

// Traduce cualquier error al llamar a Fish Audio en una respuesta HTTP con el
// status/mensaje real (en vez de esconderlo todo detrás de un 502 genérico).
function sendFishAudioError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof FishAudioTimeoutError) {
    res.status(504).json({ message: 'Fish Audio no respondió a tiempo, inténtalo de nuevo.' })
    return
  }

  if (error instanceof FishAudioError) {
    const status = error.statusCode ?? 502
    let message = FISH_ERROR_MESSAGES[status] ?? (status >= 500 ? 'Error del servidor de Fish Audio.' : fallbackMessage)

    // Los errores 422 llegan como { detail: [{ loc, msg, type }, ...] } — se añade
    // el primero al mensaje para saber qué campo falló sin tener que mirar los logs.
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

const app = express()
app.use(express.json())
const upload = multer({ storage: multer.memoryStorage() })

// --- Favoritos ---
// Modelos base (backends de Fish Audio, no tienen _id propio) y voces clonadas
// que el usuario marca para tenerlas a mano en un panel aparte. No es algo que
// ofrezca la API de Fish Audio (no hay forma de listar "mis marcados/likes"),
// así que se guarda aquí en un JSON propio del backend.
type Favorite = { key: string; type: 'model' | 'voice'; id: string; label: string }
const favoritesPath = path.resolve(import.meta.dirname, 'data/favorites.json')

async function readFavorites(): Promise<Favorite[]> {
  try {
    return JSON.parse(await readFile(favoritesPath, 'utf-8'))
  } catch {
    return []
  }
}

async function writeFavorites(favorites: Favorite[]) {
  await mkdir(path.dirname(favoritesPath), { recursive: true })
  await writeFile(favoritesPath, JSON.stringify(favorites, null, 2))
}

app.get('/api/favorites', async (_req, res) => {
  res.json(await readFavorites())
})

app.post('/api/favorites', async (req, res) => {
  const { type, id, label } = req.body ?? {}
  if ((type !== 'model' && type !== 'voice') || typeof id !== 'string' || !id || typeof label !== 'string' || !label) {
    res.status(400).json({ message: 'Faltan campos: "type" ("model" o "voice"), "id" y "label".' })
    return
  }

  const key = `${type}:${id}`
  const favorites = await readFavorites()
  if (!favorites.some((f) => f.key === key)) {
    favorites.push({ key, type, id, label })
    await writeFavorites(favorites)
  }
  res.status(201).json(favorites)
})

app.delete('/api/favorites/:key', async (req, res) => {
  const favorites = (await readFavorites()).filter((f) => f.key !== req.params.key)
  await writeFavorites(favorites)
  res.json(favorites)
})

// --- Texto a voz ---
app.post('/api/tts', async (req, res) => {
  const { text, referenceId, model } = req.body ?? {}
  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ message: 'Falta el campo "text".' })
    return
  }

  try {
    const audio = await fishAudio.textToSpeech.convert(
      { text, reference_id: referenceId || undefined },
      (model as FishModel as unknown as Backends) || undefined,
    )
    res.setHeader('Content-Type', 'audio/mpeg')
    Readable.from(audio).pipe(res)
  } catch (error) {
    sendFishAudioError(res, error, 'No se ha podido generar el audio con Fish Audio.')
  }
})

// --- Voces clonadas ---
app.get('/api/voices', async (_req, res) => {
  try {
    const result = await fishAudio.voices.search({ self: true })
    res.json(result.items.map(toVoiceModel))
  } catch (error) {
    sendFishAudioError(res, error, 'No se han podido obtener tus voces de Fish Audio.')
  }
})

app.post('/api/voices', upload.array('voices'), async (req, res) => {
  const { title } = req.body ?? {}
  const files = (req.files as Express.Multer.File[] | undefined) ?? []

  if (typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ message: 'Falta el campo "title".' })
    return
  }
  if (files.length === 0) {
    res.status(400).json({ message: 'Sube al menos un audio de referencia.' })
    return
  }

  try {
    const voice = await fishAudio.voices.ivc.create({
      title,
      // Privado por defecto: un modelo público exige además una cover_image,
      // que aquí no pedimos, y además no queremos publicar las voces por defecto.
      visibility: 'private',
      voices: files.map(
        (file) => new File([new Uint8Array(file.buffer)], file.originalname, { type: file.mimetype }),
      ),
    })
    res.status(201).json(toVoiceModel(voice))
  } catch (error) {
    sendFishAudioError(res, error, 'No se ha podido crear la voz en Fish Audio.')
  }
})

app.delete('/api/voices/:id', async (req, res) => {
  try {
    await fishAudio.voices.delete(req.params.id)
    res.status(204).end()
  } catch (error) {
    sendFishAudioError(res, error, 'No se ha podido eliminar la voz en Fish Audio.')
  }
})

// --- Frontend ---
// En producción este mismo backend sirve el build de Vite (frontend/dist).
// En dev el frontend corre aparte en el puerto 5173 (`pnpm dev`) y le llega
// tráfico /api vía el proxy de Vite, así que aquí solo se avisa de eso.
const frontendDist = path.resolve(import.meta.dirname, '../frontend/dist')
if (existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist))
  // Express 5 (path-to-regexp v8) ya no acepta '*' suelto como comodín;
  // hay que nombrar el resto de la ruta ("splat").
  app.get('/*splat', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
} else {
  app.get('/', (_req, res) => {
    res.send('Backend de Fish Audio corriendo. El frontend está en http://localhost:5173 (pnpm dev).')
  })
}

app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`)
})
