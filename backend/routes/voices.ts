import { Router } from 'express'
import type { RequestHandler } from 'express'
import multer from 'multer'
import { fishAudioFetch, requireFishAudio, sendFishAudioError, toVoiceModel } from '../lib/fish-audio-client.ts'

// Formatos que acepta la clonación instantánea de Fish Audio.
// https://docs.fish.audio/features/voice-cloning
const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.opus']
const MAX_VOICES = 20

// Fish Audio no publica un tamaño máximo por fichero. Este límite es nuestro, solo para que
// un audio enorme no se cargue entero en memoria (multer usa memoryStorage).
const MAX_FILE_BYTES = 100 * 1024 * 1024

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } })
const router = Router()

// Los errores de multer llegan como excepción del middleware: sin esto Express devolvería
// un 500 con su página de error por defecto en vez de un mensaje útil.
function withUpload(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    middleware(req, res, (err: unknown) => {
      if (!err) return next()
      const code = (err as { code?: string }).code
      const message =
        code === 'LIMIT_FILE_SIZE'
          ? 'Algún archivo supera los 100 MB. Expórtalo comprimido (p. ej. MP3 en vez de WAV).'
          : code === 'LIMIT_FILE_COUNT' || code === 'LIMIT_UNEXPECTED_FILE'
            ? `Sube como máximo ${MAX_VOICES} audios de referencia.`
            : 'No se han podido leer los archivos enviados.'
      res.status(400).json({ message })
    })
  }
}

// Un campo repetido llega como string suelto si viene una sola vez, y como array si viene varias.
function asArray(value: unknown): string[] {
  if (value === undefined || value === null) return []
  return (Array.isArray(value) ? value : [value]).map(String)
}

function toFile(file: Express.Multer.File): File {
  return new File([new Uint8Array(file.buffer)], file.originalname, { type: file.mimetype })
}

function hasAllowedExtension(name: string): boolean {
  return AUDIO_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
}

router.get('/api/voices', async (_req, res) => {
  const client = requireFishAudio(res)
  if (!client) return

  try {
    const result = await client.voices.search({ self: true })
    res.json(result.items.map(toVoiceModel))
  } catch (error) {
    sendFishAudioError(res, error, 'No se han podido obtener tus voces de Fish Audio.')
  }
})

router.post(
  '/api/voices',
  // maxCount es MAX_VOICES + 1 para poder dar un mensaje propio al pasarse, en vez del
  // "Unexpected field" de multer.
  withUpload(upload.fields([{ name: 'voices', maxCount: MAX_VOICES + 1 }, { name: 'cover_image', maxCount: 1 }])),
  async (req, res) => {
    const client = requireFishAudio(res)
    if (!client) return

    const body = (req.body ?? {}) as Record<string, unknown>
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>
    const voices = files.voices ?? []
    const coverImage = files.cover_image?.[0]

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      res.status(400).json({ message: 'Falta el campo "title".' })
      return
    }
    if (voices.length === 0) {
      res.status(400).json({ message: 'Sube al menos un audio de referencia.' })
      return
    }
    if (voices.length > MAX_VOICES) {
      res.status(400).json({ message: `Sube como máximo ${MAX_VOICES} audios de referencia.` })
      return
    }

    const invalid = voices.filter((file) => !hasAllowedExtension(file.originalname))
    if (invalid.length > 0) {
      res.status(400).json({
        message: `Formato no admitido (${invalid.map((f) => f.originalname).join(', ')}). Fish Audio acepta ${AUDIO_EXTENSIONS.join(', ')}.`,
      })
      return
    }

    // O van todas las transcripciones, o ninguna: el formulario manda una cadena vacía por
    // cada audio sin transcribir, y enviarlas incompletas las desplazaría de audio.
    const texts = asArray(body.texts)
    const allTexts = texts.length === voices.length && texts.every((text) => text.trim())

    const form = new FormData()
    form.append('type', 'tts')
    form.append('train_mode', 'fast')
    form.append('title', title)
    for (const file of voices) form.append('voices', toFile(file))
    if (allTexts) for (const text of texts) form.append('texts', text)
    for (const tag of asArray(body.tags)) form.append('tags', tag)
    if (typeof body.description === 'string' && body.description.trim()) {
      form.append('description', body.description.trim())
    }
    // Cualquier valor que no sea `unlist` cae en `private`, el más restrictivo.
    const visibility = body.visibility === 'unlist' ? 'unlist' : 'private'
    form.append('visibility', visibility)
    if (coverImage) form.append('cover_image', toFile(coverImage))
    form.append('enhance_audio_quality', String(body.enhance_audio_quality === 'true'))
    form.append('generate_sample', String(body.generate_sample === 'true'))

    try {
      const voice = await fishAudioFetch('/model', 'POST', form)
      res.status(201).json(toVoiceModel(voice as Parameters<typeof toVoiceModel>[0]))
    } catch (error) {
      sendFishAudioError(res, error, 'No se ha podido crear la voz en Fish Audio.')
    }
  },
)

router.patch('/api/voices/:id', withUpload(upload.single('cover_image')), async (req, res) => {
  const client = requireFishAudio(res)
  if (!client) return

  const id = String(req.params.id)
  const body = (req.body ?? {}) as Record<string, unknown>
  const coverImage = req.file

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    res.status(400).json({ message: 'El título no puede quedar vacío.' })
    return
  }

  // Se manda siempre el formulario entero: los campos que el usuario deje vacíos se guardan
  // vacíos, en vez de conservar el valor anterior.
  const patch = {
    title,
    description: typeof body.description === 'string' ? body.description.trim() : '',
    visibility: body.visibility === 'unlist' ? 'unlist' : 'private',
    tags: asArray(body.tags),
  }

  try {
    if (coverImage) {
      const form = new FormData()
      form.append('title', patch.title)
      form.append('description', patch.description)
      form.append('visibility', patch.visibility)
      for (const tag of patch.tags) form.append('tags', tag)
      form.append('cover_image', toFile(coverImage))
      await fishAudioFetch(`/model/${id}`, 'PATCH', form)
    } else {
      // Sin imagen se manda JSON: multipart no sabe expresar "lista vacía", así que sería
      // imposible quitarle todas las etiquetas a una voz.
      await fishAudioFetch(`/model/${id}`, 'PATCH', JSON.stringify(patch))
    }
  } catch (error) {
    sendFishAudioError(res, error, 'No se ha podido actualizar la voz en Fish Audio.')
    return
  }

  // Bloque aparte porque los cambios ya se guardaron: si esta relectura falla, la respuesta
  // no puede decir que la edición fallara.
  try {
    const updated = await client.voices.get(id)
    res.json(toVoiceModel(updated))
  } catch (error) {
    console.error('La voz se actualizó pero no se ha podido releer:', error)
    res.status(200).json({ id, ...patch, stale: true })
  }
})

router.delete('/api/voices/:id', async (req, res) => {
  const client = requireFishAudio(res)
  if (!client) return

  try {
    await client.voices.delete(req.params.id)
    res.status(204).end()
  } catch (error) {
    sendFishAudioError(res, error, 'No se ha podido eliminar la voz en Fish Audio.')
  }
})

export default router
