// Paginación común a los listados (historial, voces, voces compartidas).
import type { Request } from 'express'

export type Page<T> = {
    items: T[]
    total: number
    page: number
    pageSize: number
}

export const DEFAULT_PAGE_SIZE = 12

// Tope propio: sin él, un `pageSize` enorme en la URL anularía la paginación.
const MAX_PAGE_SIZE = 100

function toPositiveInt(value: unknown, fallback: number): number {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback
    }
    return Math.floor(parsed)
}

export function readPageQuery(req: Request, defaultPageSize: number = DEFAULT_PAGE_SIZE) {
    return {
        page: toPositiveInt(req.query.page, 1),
        pageSize: Math.min(toPositiveInt(req.query.pageSize, defaultPageSize), MAX_PAGE_SIZE),
        search: typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '',
    }
}

export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
    const start = (page - 1) * pageSize
    return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize }
}
