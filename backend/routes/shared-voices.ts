// La API de Fish Audio no distingue "tuya" de "de otro autor" para /model/{id}:
// si el ID es válido y la voz es pública (o no listada, con el enlace), se puede
// pedir su info y usarla como reference_id igual que una voz propia. Se guarda
// aquí el snapshot completo (título, portada, autor...) en vez de solo el ID:
// así el listado se sirve directo del JSON sin depender de volver a llamar a
// Fish Audio cada vez (que si falla por lo que sea, hacía "desaparecer" voces
// que en realidad seguían guardadas).
import path from 'node:path'
import { Router } from 'express'
import { createJsonStore } from '../lib/json-store.ts'
import { requireFishAudio, sendFishAudioError, toVoiceModel, type VoiceModel } from '../lib/fish-audio-client.ts'

const sharedVoicesPath = path.resolve(import.meta.dirname, '../data/shared-voices.json')
const sharedVoicesStore = createJsonStore<VoiceModel>(sharedVoicesPath)

// Acepta el ID a secas o cualquiera de los formatos de enlace de fish.audio:
// la página pública de una voz (https://fish.audio/m/<id>) y el estudio de
// TTS, que lleva el ID en un parámetro de la URL (?modelId=<id>).
function extractVoiceId(input: string): string {
  const trimmed = input.trim()

  try {
    const url = new URL(trimmed)
    const fromQuery = url.searchParams.get('modelId') ?? url.searchParams.get('reference_id') ?? url.searchParams.get('id')
    if (fromQuery) return fromQuery

    const fromPath = url.pathname.match(/\/m\/([^/?#]+)/)
    if (fromPath) return fromPath[1]
  } catch {
    // No es una URL (probablemente ya es el ID a secas); se sigue abajo.
  }

  // Último recurso: los IDs de Fish Audio son 32 caracteres hexadecimales,
  // así que se busca uno en cualquier parte del texto pegado.
  const hexMatch = trimmed.match(/[0-9a-f]{32}/i)
  return hexMatch ? hexMatch[0] : trimmed
}

const router = Router()

router.get('/api/shared-voices', async (_req, res) => {
  res.json(await sharedVoicesStore.read())
})

router.post('/api/shared-voices', async (req, res) => {
  const client = requireFishAudio(res)
  if (!client) return

  const { input } = req.body ?? {}
  if (typeof input !== 'string' || !input.trim()) {
    res.status(400).json({ message: 'Pega el enlace de la voz (https://fish.audio/m/...) o su ID.' })
    return
  }

  const id = extractVoiceId(input)
  try {
    const voice = toVoiceModel(await client.voices.get(id))
    const voices = await sharedVoicesStore.read()
    const next = [...voices.filter((v) => v.id !== id), voice]
    await sharedVoicesStore.write(next)
    res.status(201).json(voice)
  } catch (error) {
    sendFishAudioError(res, error, 'No se ha podido encontrar esa voz en Fish Audio.')
  }
})

router.delete('/api/shared-voices/:id', async (req, res) => {
  const voices = (await sharedVoicesStore.read()).filter((v) => v.id !== req.params.id)
  await sharedVoicesStore.write(voices)
  res.status(204).end()
})

export default router
