// Único sitio donde se resuelven rutas del proyecto.
import path from 'node:path'

// backend/lib -> raíz del proyecto
export const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..')

// Datos locales del usuario (fuera de backend/, ver .gitignore).
export const DATA_DIR = path.resolve(PROJECT_ROOT, 'data')
export const GENERATIONS_DIR = path.resolve(DATA_DIR, 'generations')
export const GENERATIONS_PATH = path.resolve(DATA_DIR, 'generations.json')
export const FAVORITES_PATH = path.resolve(DATA_DIR, 'favorites.json')
export const SHARED_VOICES_PATH = path.resolve(DATA_DIR, 'shared-voices.json')

// Build de Vite que sirve el backend en producción.
export const FRONTEND_DIST_DIR = path.resolve(PROJECT_ROOT, 'frontend/dist')
