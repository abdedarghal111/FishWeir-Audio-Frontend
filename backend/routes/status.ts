// --- Disponibilidad de integraciones externas (Fish Audio, DeepSeek) ---
// El frontend consulta ambos al arrancar para saber si mostrar/ocultar los
// controles que dependen de cada uno (generar audio, clonar voces y añadir
// voces compartidas nuevas para Fish Audio; el botón "Mejorar con IA" para
// DeepSeek), sin esperar a que fallen.
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
