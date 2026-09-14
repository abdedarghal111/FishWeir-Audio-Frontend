// En producción sirve el build de Vite (frontend/dist). En dev el frontend
// corre aparte (`pnpm dev`, puerto 5173) y solo se avisa de eso.
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Express } from 'express'
import express from 'express'
import { FRONTEND_DIST_DIR } from './paths.ts'

export function serveFrontend(app: Express) {
    if (existsSync(path.join(FRONTEND_DIST_DIR, 'index.html'))) {
        app.use(express.static(FRONTEND_DIST_DIR))
        // Express 5 (path-to-regexp v8) ya no acepta '*' suelto como comodín;
        // hay que nombrar el resto de la ruta ("splat").
        app.get('/*splat', (_req, res) => {
            res.sendFile(path.join(FRONTEND_DIST_DIR, 'index.html'))
        })
    } else {
        app.get('/', (_req, res) => {
            res.send('Backend de FishWeir Audio Frontend corriendo. El frontend está en http://localhost:5173 (pnpm dev).')
        })
    }
}
