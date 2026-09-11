// Cada audio generado se guarda en disco (.wav) más su metadata en un JSON.
// Módulo propio porque lo usan dos routers: tts.ts escribe, generations.ts lee/borra.
import { createJsonStore } from './json-store.ts'
import { GENERATIONS_PATH } from './paths.ts'

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

export const generationsStore = createJsonStore<Generation>(GENERATIONS_PATH)
