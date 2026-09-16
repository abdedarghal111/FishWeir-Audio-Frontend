// Compara la versión instalada con la última publicada en GitHub. Se consulta desde el
// backend y con caché porque la API pública admite 60 peticiones por hora e IP.
import pkg from '../../package.json' with { type: 'json' }

const REPOSITORY = 'abdedarghal111/FishWeir-Audio-Frontend'

export type UpdateStatus = {
    status: 'up-to-date' | 'update-available' | 'unknown'
    // Motivo por el que no se ha podido comprobar; sólo con status 'unknown'.
    reason?: string
    currentVersion: string
    latestVersion?: string
    releaseUrl?: string
    checkedAt: string
}

// Mismo intervalo con el que el frontend vuelve a preguntar.
const CACHE_TTL_MS = 15 * 60 * 1000
const REQUEST_TIMEOUT_MS = 10_000

// Sin persistir: al reiniciar el backend se vuelve a preguntar.
let cached: UpdateStatus | null = null

export async function checkForUpdate(): Promise<UpdateStatus> {
    if (cached && Date.now() - Date.parse(cached.checkedAt) < CACHE_TTL_MS) {
        return cached
    }

    const status = await buildStatus()
    // Un fallo no se cachea: se reintenta en la siguiente consulta.
    if (status.status !== 'unknown') {
        cached = status
    }
    return status
}

async function buildStatus(): Promise<UpdateStatus> {
    const checkedAt = new Date().toISOString()
    const currentVersion = pkg.version

    const release = await latestRelease()
    if (!release) {
        return {
            status: 'unknown',
            reason: 'No se ha podido consultar la última versión publicada en GitHub',
            currentVersion,
            checkedAt,
        }
    }

    const current = parseVersion(currentVersion)
    const latest = parseVersion(release.tagName)
    if (!current || !latest) {
        return {
            status: 'unknown',
            reason: 'Alguna de las versiones no tiene el formato esperado',
            currentVersion,
            latestVersion: release.tagName,
            releaseUrl: release.releaseUrl,
            checkedAt,
        }
    }

    return {
        status: isNewer(latest, current) ? 'update-available' : 'up-to-date',
        currentVersion,
        latestVersion: release.tagName,
        releaseUrl: release.releaseUrl,
        checkedAt,
    }
}

async function latestRelease(): Promise<{ tagName: string; releaseUrl: string } | null> {
    try {
        const res = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
            headers: { Accept: 'application/vnd.github+json' },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        if (!res.ok) {
            return null
        }

        const data = await res.json()
        if (typeof data?.tag_name !== 'string' || typeof data?.html_url !== 'string') {
            return null
        }
        return { tagName: data.tag_name, releaseUrl: data.html_url }
    } catch {
        // Sin red, timeout o respuesta ilegible: no se propaga como error.
        return null
    }
}

// "v1.2.3" o "1.2.3" -> [1, 2, 3]
function parseVersion(value: string): number[] | null {
    const match = value.match(/(\d+)\.(\d+)\.(\d+)/)
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

function isNewer(latest: number[], current: number[]): boolean {
    for (let i = 0; i < latest.length; i++) {
        if (latest[i] !== current[i]) {
            return latest[i] > current[i]
        }
    }
    return false
}
