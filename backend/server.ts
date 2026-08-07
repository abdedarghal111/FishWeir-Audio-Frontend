// Entrypoint: registra cada router de dominio (backend/routes/*.ts) y arranca
// el servidor. Los clientes compartidos (Fish Audio, DeepSeek) y la
// persistencia en disco viven en backend/lib/*.ts; aquí solo se compone,
// igual que App.svelte hace con los componentes del frontend.
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

// Sirve el frontend estático en producción; en dev queda como aviso (ver
// lib/frontend-static.ts). Va al final para no interceptar las rutas /api de
// arriba con el comodín '/*splat'.
serveFrontend(app)

app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`)
})
