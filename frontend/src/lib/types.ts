export type Voice = {
  id: string
  title: string
  description?: string
  coverImage?: string
  state?: 'created' | 'training' | 'trained' | 'failed'
  tags?: string[]
  createdAt?: string
  updatedAt?: string
  visibility?: 'public' | 'unlist' | 'private'
  likeCount?: number
  markCount?: number
  sharedCount?: number
  taskCount?: number
  author?: { _id: string; nickname: string; avatar: string }
  trainMode?: 'fast' | 'full'
  languages?: string[]
  samples?: { title: string; text: string; task_id: string; audio: string }
}

export type Favorite = { key: string; type: 'model' | 'voice'; id: string; label: string }

// Una generación de audio ya guardada en el servidor (backend/data/generations),
// con su metadata para poder reconocerla después sin tener que reproducirla.
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
  // §5), guardados junto al resto de la metadata para poder ver con qué
  // ajustes se generó cada audio.
  speed?: number
  volume?: number
  temperature?: number
  topP?: number
  chunkLength?: number
  normalize?: boolean
  latency?: 'normal' | 'balanced'
  sampleRate?: number
}

export const STATE_LABELS: Record<string, string> = {
  created: 'Creada',
  training: 'Entrenando',
  trained: 'Entrenada',
  failed: 'Fallida',
}

export const STATE_BADGES: Record<string, string> = {
  created: 'text-bg-secondary',
  training: 'text-bg-warning',
  trained: 'text-bg-success',
  failed: 'text-bg-danger',
}

export const VISIBILITY_LABELS: Record<string, string> = {
  private: 'Privada',
  unlist: 'No listada',
  public: 'Pública',
}

export const MODELS = [
  { value: 's2.1-pro-free', label: 's2.1-pro-free (gratis, para pruebas)' },
  { value: 's2.1-pro', label: 's2.1-pro (por defecto en producción)' },
  { value: 's2-pro', label: 's2-pro' },
  { value: 's1', label: 's1' },
]

export function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}

export async function errorMessage(res: Response, fallback: string) {
  return (await res.json().catch(() => null))?.message ?? fallback
}

// Recuerda selecciones del formulario (modelo, voz clonada...) entre visitas,
// para no tener que volver a elegirlas cada vez que se abre la página.
const STORAGE_PREFIX = 'fish-audio:'

export function loadPersisted<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function savePersisted<T>(key: string, value: T) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota llena...); no es crítico.
  }
}
