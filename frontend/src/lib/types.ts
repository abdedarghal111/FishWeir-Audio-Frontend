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
    samples?: VoiceSample[]
    // Sólo llega en la respuesta de crear la voz.
    quality?: AudioQuality[]
}

export type VoiceSample = { title: string; text: string; task_id: string; audio: string }

export type AudioQuality = {
    filename: string
    duration_ms: number
    language?: string
    quality?: Record<string, number>
    quality_passed?: boolean
    quality_reason?: string
}

// Lo que se puede cambiar de una voz ya creada.
export type VoiceEdit = {
    title: string
    description: string
    visibility: VoiceVisibility
    tags: string[]
    coverImage?: File
}

export type VoiceVisibility = 'private' | 'unlist'

// Lo que recoge el formulario de clonación.
export type NewVoice = {
    title: string
    files: File[]
    texts: string[]
    description: string
    tags: string[]
    visibility: VoiceVisibility
    coverImage?: File
    enhanceAudioQuality: boolean
    generateSample: boolean
}

// Falta "pública" a propósito: publicar una voz sólo se puede desde fish.audio.
export const VISIBILITY_OPTIONS: { value: VoiceVisibility; label: string; hint: string }[] = [
    { value: 'private', label: 'Privada', hint: 'Sólo tú puedes verla y usarla.' },
    { value: 'unlist', label: 'No listada', hint: 'Cualquiera con el enlace puede usarla, pero no aparece en el catálogo.' },
]

// Formatos y límites de la clonación instantánea (docs.fish.audio/features/voice-cloning).
export const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.opus']
export const MAX_VOICE_FILES = 20

// Datos de la voz elegida que necesita el formulario de generación. Se guardan aparte de los
// listados porque la voz seleccionada puede no estar en la página que se muestra.
export type SelectedVoice = { id: string; title: string; coverImage?: string }

export type Favorite = { key: string; type: 'model' | 'voice'; id: string; label: string }

// Respuesta de los listados paginados del backend (historial, voces, voces compartidas).
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number }

// Generación de audio persistida en el servidor (data/generations).
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
    // Parámetros avanzados (ver docs/emociones-y-tono-fish-audio.md §5), persistidos para
    // conocer con qué ajustes se generó cada audio.
    speed?: number
    volume?: number
    temperature?: number
    topP?: number
    chunkLength?: number
    normalize?: boolean
    latency?: 'normal' | 'balanced'
    sampleRate?: number
}

// `credit` es dinero de prepago y `package` la cuota del plan, en caracteres.
export type Wallet = {
    credit: number
    package: {
        type: string
        total: number
        balance: number
    } | null
}

// Respuesta de /api/update: versión instalada frente a la última publicada en GitHub.
export type UpdateStatus = {
    status: 'up-to-date' | 'update-available' | 'unknown'
    reason?: string
    currentVersion: string
    latestVersion?: string
    releaseUrl?: string
    checkedAt: string
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

// Persiste selecciones del formulario (modelo, voz clonada...) entre visitas.
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
        // localStorage puede no estar disponible (modo privado, cuota agotada, etc.); el fallo no es crítico.
    }
}

// Las etiquetas se escriben separadas por comas; se limpian espacios, vacíos y repetidas.
export function parseTags(input: string): string[] {
    return [...new Set(input.split(',').map((tag) => tag.trim()).filter(Boolean))]
}
