// Persistencia del historial de audios generados: cada generación se guarda
// en disco (el .wav, gestionado directamente por routes/tts.ts) más una
// entrada de metadata (texto, modelo, voz usada, fecha) en un JSON, mismo
// patrón que favoritos y voces compartidas. Así se puede volver a
// escuchar/descargar más tarde sin depender de que el navegador siga
// teniendo el blob en memoria.
//
// Vive en su propio módulo (a diferencia de favoritos o voces compartidas)
// porque es el único store que usan dos routers distintos: routes/tts.ts
// escribe una entrada nueva al generar audio, routes/generations.ts lee y
// borra del mismo JSON.
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
  // Parámetros avanzados de generación (ver docs/emociones-y-tono-fish-audio.md
  // §5), guardados junto al resto para poder ver con qué ajustes se generó
  // cada audio del historial.
  speed?: number
  volume?: number
  temperature?: number
  topP?: number
  chunkLength?: number
  normalize?: boolean
  latency?: 'normal' | 'balanced'
  sampleRate?: number
}

export const generationsDir = path.resolve(import.meta.dirname, '../data/generations')
const generationsPath = path.resolve(import.meta.dirname, '../data/generations.json')

export const generationsStore = createJsonStore<Generation>(generationsPath)
