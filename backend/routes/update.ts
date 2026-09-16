import { Router } from 'express'
import { checkForUpdate } from '../lib/update-check.ts'

const router = Router()

router.get('/api/update', async (_req, res) => {
    res.json(await checkForUpdate())
})

export default router
