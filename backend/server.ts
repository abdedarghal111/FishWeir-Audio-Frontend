import express from 'express'
import favoritesRouter from './routes/favorites.ts'
import generationsRouter from './routes/generations.ts'
import ttsRouter from './routes/tts.ts'
import voicesRouter from './routes/voices.ts'
import sharedVoicesRouter from './routes/shared-voices.ts'
import enhanceTextRouter from './routes/enhance-text.ts'
import statusRouter from './routes/status.ts'
import { serveFrontend } from './lib/frontend-static.ts'

const PORT = Number(process.env.PORT) || 4000

const app = express()
app.use(express.json())

app.use(favoritesRouter)
app.use(generationsRouter)
app.use(ttsRouter)
app.use(voicesRouter)
app.use(sharedVoicesRouter)
app.use(enhanceTextRouter)
app.use(statusRouter)

// Se registra al final para no interceptar las rutas /api con el comodín '/*splat'.
serveFrontend(app)

app.listen(PORT, () => {
    console.log(`Backend escuchando en http://localhost:${PORT}`)
})
