import { Router } from 'express'
import multer from 'multer'
import { requireFishAudio, sendFishAudioError, toVoiceModel } from '../lib/fish-audio-client.ts'

const upload = multer({ storage: multer.memoryStorage() })
const router = Router()

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

router.post('/api/voices', upload.array('voices'), async (req, res) => {
  const client = requireFishAudio(res)
  if (!client) return

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
    const voice = await client.voices.ivc.create({
      title,
      // Privado por defecto: un modelo público requeriría además una cover_image no solicitada aquí.
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
