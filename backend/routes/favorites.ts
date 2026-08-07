// Modelos base (backends de Fish Audio, no tienen _id propio) y voces clonadas
// que el usuario marca para tenerlas a mano en un panel aparte. No es algo que
// ofrezca la API de Fish Audio (no hay forma de listar "mis marcados/likes"),
// así que se guarda aquí en un JSON propio del backend.
import path from 'node:path'
import { Router } from 'express'
import { createJsonStore } from '../lib/json-store.ts'

type Favorite = { key: string; type: 'model' | 'voice'; id: string; label: string }
const favoritesPath = path.resolve(import.meta.dirname, '../data/favorites.json')
const favoritesStore = createJsonStore<Favorite>(favoritesPath)

const router = Router()

router.get('/api/favorites', async (_req, res) => {
  res.json(await favoritesStore.read())
})

router.post('/api/favorites', async (req, res) => {
  const { type, id, label } = req.body ?? {}
  if ((type !== 'model' && type !== 'voice') || typeof id !== 'string' || !id || typeof label !== 'string' || !label) {
    res.status(400).json({ message: 'Faltan campos: "type" ("model" o "voice"), "id" y "label".' })
    return
  }

  const key = `${type}:${id}`
  const favorites = await favoritesStore.read()
  if (!favorites.some((f) => f.key === key)) {
    favorites.push({ key, type, id, label })
    await favoritesStore.write(favorites)
  }
  res.status(201).json(favorites)
})

router.delete('/api/favorites/:key', async (req, res) => {
  const favorites = (await favoritesStore.read()).filter((f) => f.key !== req.params.key)
  await favoritesStore.write(favorites)
  res.json(favorites)
})

export default router
