// Cada audio generado se guarda en disco (.wav) más su metadata en un JSON.
// Módulo propio porque lo usan dos routers: tts.ts escribe, generations.ts lee/borra.
import path from 'node:path'
import { createJsonStore } from './json-store.ts'

export type Generation = {
  id: string
  createdAt: string
  text: string
  model: string
  referenceId?: string
  voiceTitle?: string
  format: 'wav'
  fileName: string
  sizeBytes: number
  // Parámetros avanzados de generación (docs/emociones-y-tono-fish-audio.md §5).
  speed?: number
  volume?: number
  temperature?: number
  topP?: number
  chunkLength?: number
  normalize?: boolean
  latency?: 'normal' | 'balanced'
  sampleRate?: number
}

export const generationsDir = path.resolve(import.meta.dirname, '../../data/generations')
const generationsPath = path.resolve(import.meta.dirname, '../../data/generations.json')

export const generationsStore = createJsonStore<Generation>(generationsPath)
