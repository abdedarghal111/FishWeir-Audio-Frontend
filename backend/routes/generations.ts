import path from 'node:path'
import { unlink } from 'node:fs/promises'
import { Router } from 'express'
import { generationsStore } from '../lib/generations-store.ts'
import { GENERATIONS_DIR } from '../lib/paths.ts'

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
    // "inline" (no "attachment") para que el <audio> lo reproduzca en vez de descargarlo.
    res.setHeader('Content-Disposition', `inline; filename="${generation.id}.${generation.format}"`)
    res.sendFile(path.resolve(GENERATIONS_DIR, generation.fileName), (err) => {
        // sendFile también invoca este callback si el cliente aborta la petición a medio
        // envío; en ese caso las cabeceras ya se enviaron, de ahí la comprobación de headersSent.
        if (err && !res.headersSent) {
            res.status(404).json({ message: 'El archivo de audio ya no está disponible.' })
        }
    })
})

router.delete('/api/generations/:id', async (req, res) => {
    const generations = await generationsStore.read()
    const generation = generations.find((g) => g.id === req.params.id)
    await generationsStore.write(generations.filter((g) => g.id !== req.params.id))
    if (generation) await unlink(path.resolve(GENERATIONS_DIR, generation.fileName)).catch(() => {})
    res.status(204).end()
})

export default router
