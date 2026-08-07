// El frontend consulta esto al arrancar para ocultar los controles que
// dependen de cada integración en vez de esperar a que fallen.
import { Router } from 'express'
import { fishAudio } from '../lib/fish-audio-client.ts'
import { deepSeek } from '../lib/deepseek-client.ts'

const router = Router()

router.get('/api/fish-audio/status', (_req, res) => {
  res.json({ available: fishAudio !== null })
})

router.get('/api/enhance-text/status', (_req, res) => {
  res.json({ available: deepSeek !== null })
})

export default router
