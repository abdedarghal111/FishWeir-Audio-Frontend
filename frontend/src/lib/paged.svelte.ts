// Estado común de los listados paginados: página, búsqueda y carga contra un endpoint del backend.
import { errorMessage, type Page } from './types'

const SEARCH_DEBOUNCE_MS = 300

export type PagedResourceOptions = {
    pageSize?: number
    onError?: (message: string) => void
}

export function createPagedResource<T>(url: string, options: PagedResourceOptions = {}) {
    let items: T[] = $state([])
    let total = $state(0)
    let page = $state(1)
    let pageSize = $state(options.pageSize ?? 12)
    let search = $state('')
    let loading = $state(false)

    // Número de orden de cada petición: si las respuestas se cruzan, sólo se aplica la última.
    let lastRequestId = 0
    let searchTimer: ReturnType<typeof setTimeout> | undefined

    async function load(): Promise<void> {
        const requestId = ++lastRequestId
        loading = true
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
            if (search.trim()) {
                params.set('q', search.trim())
            }

            const res = await fetch(`${url}?${params}`)
            if (!res.ok) {
                throw new Error(await errorMessage(res, `Error ${res.status}`))
            }

            const data: Page<T> = await res.json()
            if (requestId !== lastRequestId) {
                return
            }

            total = data.total

            // Al borrar el último elemento de una página, esa página deja de existir.
            const lastPage = Math.max(1, Math.ceil(data.total / pageSize))
            if (data.items.length === 0 && page > 1 && lastPage < page) {
                page = lastPage
                await load()
                return
            }

            items = data.items
        } catch (err) {
            if (requestId !== lastRequestId) {
                return
            }
            items = []
            total = 0
            options.onError?.(err instanceof Error ? err.message : 'No se ha podido cargar la lista')
        } finally {
            if (requestId === lastRequestId) {
                loading = false
            }
        }
    }

    function scheduleSearch() {
        clearTimeout(searchTimer)
        searchTimer = setTimeout(load, SEARCH_DEBOUNCE_MS)
    }

    return {
        get items() {
            return items
        },
        get total() {
            return total
        },
        get page() {
            return page
        },
        get pageSize() {
            return pageSize
        },
        get pageCount() {
            return Math.max(1, Math.ceil(total / pageSize))
        },
        get loading() {
            return loading
        },
        get search() {
            return search
        },
        // Se escribe desde el campo de búsqueda: espera antes de consultar para no pedir una página por tecla.
        set search(value: string) {
            search = value
            page = 1
            scheduleSearch()
        },
        load,
        setPage(value: number) {
            page = value
            load()
        },
        setPageSize(value: number) {
            pageSize = value
            page = 1
            load()
        },
        // Vacía el listado sin consultar, para secciones no disponibles.
        clear() {
            lastRequestId++
            items = []
            total = 0
            page = 1
            loading = false
        },
    }
}

export type PagedResource<T> = ReturnType<typeof createPagedResource<T>>
