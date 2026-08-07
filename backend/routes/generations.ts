// --- Historial de audios generados ---
// Lee/borra lo que routes/tts.ts escribe al generar audio (ver
// lib/generations-store.ts para la persistencia compartida entre ambos).
import path from 'node:path'
import { unlink } from 'node:fs/promises'
import { Router } from 'express'
import { generationsDir, generationsStore } from '../lib/generations-store.ts'

const router = Router()

router.get('/api/generations', async (_req, res) => {
  res.json(await generationsStore.read())
})

router.get('/api/generations/:id/audio', async (req, res) => {
  const generation = (await generationsStore.read()).find((g) => g.id === req.params.id)
  if (!generation) {
    res.status(404).json({ message: 'No se ha encontrado esa generación.' })
    return
  }
  res.setHeader('Content-Type', 'audio/wav')
  // Sin esto, el navegador descarga el archivo con un nombre genérico (el
  // último trozo de la URL, "audio") en vez de algo reconocible. "inline" en
  // vez de "attachment" para que el <audio> siga reproduciéndolo en la
  // página en vez de forzar la descarga al pedirlo.
  res.setHeader('Content-Disposition', `inline; filename="${generation.id}.${generation.format}"`)
  res.sendFile(path.resolve(generationsDir, generation.fileName), (err) => {
    // sendFile también llama a este callback con error cuando el cliente aborta
    // la petición a medio envío (p. ej. el <audio> corta la conexión anterior al
    // hacer play/pause/seek seguidos) — en ese caso las cabeceras ya se
    // mandaron, así que intentar responder de nuevo revienta con
    // ERR_HTTP_HEADERS_SENT. Solo se responde si de verdad no se ha enviado nada.
    if (err && !res.headersSent) {
      res.status(404).json({ message: 'El archivo de audio ya no está disponible.' })
    }
  })
})

router.delete('/api/generations/:id', async (req, res) => {
  const generations = await generationsStore.read()
  const generation = generations.find((g) => g.id === req.params.id)
  await generationsStore.write(generations.filter((g) => g.id !== req.params.id))
  if (generation) await unlink(path.resolve(generationsDir, generation.fileName)).catch(() => {})
  res.status(204).end()
})

export default router
