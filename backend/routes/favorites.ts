import { Router } from 'express'
import { createJsonStore } from '../lib/json-store.ts'
import { FAVORITES_PATH } from '../lib/paths.ts'

type Favorite = { key: string; type: 'model' | 'voice'; id: string; label: string }
const favoritesStore = createJsonStore<Favorite>(FAVORITES_PATH)

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
