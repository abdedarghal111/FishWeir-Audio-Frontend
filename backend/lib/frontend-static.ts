// En producción este mismo backend sirve el build de Vite (frontend/dist).
// En dev el frontend corre aparte en el puerto 5173 (`pnpm dev`) y le llega
// tráfico /api vía el proxy de Vite, así que aquí solo se avisa de eso.
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Express } from 'express'
import express from 'express'

export function serveFrontend(app: Express) {
  const frontendDist = path.resolve(import.meta.dirname, '../../frontend/dist')
  if (existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist))
    // Express 5 (path-to-regexp v8) ya no acepta '*' suelto como comodín;
    // hay que nombrar el resto de la ruta ("splat").
    app.get('/*splat', (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'))
    })
  } else {
    app.get('/', (_req, res) => {
      res.send('Backend de FishWeir Audio Frontend corriendo. El frontend está en http://localhost:5173 (pnpm dev).')
    })
  }
}
