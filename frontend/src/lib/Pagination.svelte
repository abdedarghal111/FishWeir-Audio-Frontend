<script lang="ts">
    // Barra de paginación reutilizable: resumen, tamaño de página y navegación.
    let {
        page,
        pageCount,
        total,
        pageSize,
        loading = false,
        label = 'elementos',
        onPage,
        onPageSize,
    }: {
        page: number
        pageCount: number
        total: number
        pageSize: number
        loading?: boolean
        // Nombre de lo que se lista, para el resumen.
        label?: string
        onPage: (page: number) => void
        // Si no se pasa, no se ofrece cambiar el tamaño de página.
        onPageSize?: (pageSize: number) => void
    } = $props()

    const PAGE_SIZES = [6, 12, 24, 48]
    const MAX_NUMBERS = 7

    let first = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1)
    let last = $derived(Math.min(page * pageSize, total))

    // Primera, última y vecinas de la actual; el resto se resume con puntos suspensivos.
    let numbers: (number | '...')[] = $derived.by(() => {
        if (pageCount <= MAX_NUMBERS) {
            return Array.from({ length: pageCount }, (_, i) => i + 1)
        }

        const pages = new Set([1, pageCount, page])
        for (let offset = 1; offset <= 2; offset++) {
            if (page - offset > 1) {
                pages.add(page - offset)
            }
            if (page + offset < pageCount) {
                pages.add(page + offset)
            }
        }

        const sorted = [...pages].sort((a, b) => a - b)
        const result: (number | '...')[] = []
        for (const [i, value] of sorted.entries()) {
            if (i > 0 && value - sorted[i - 1] > 1) {
                result.push('...')
            }
            result.push(value)
        }
        return result
    })

    function go(target: number) {
        if (target < 1 || target > pageCount || target === page || loading) {
            return
        }
        onPage(target)
    }
</script>

{#if total > 0}
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 my-3">
        <span class="text-body-secondary small">
            {#if loading}
                <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
            {/if}
            Mostrando {first}–{last} de {total} {label}
        </span>

        {#if pageCount > 1}
            <nav aria-label="Paginación">
                <ul class="pagination pagination-sm mb-0">
                    <li class="page-item" class:disabled={page === 1}>
                        <button type="button" class="page-link" aria-label="Página anterior" onclick={() => go(page - 1)}>
                            <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
                        </button>
                    </li>

                    {#each numbers as number, i (i)}
                        {#if number === '...'}
                            <li class="page-item disabled"><span class="page-link">...</span></li>
                        {:else}
                            <li class="page-item" class:active={number === page}>
                                <button
                                    type="button"
                                    class="page-link"
                                    aria-current={number === page ? 'page' : undefined}
                                    onclick={() => go(number)}
                                >
                                    {number}
                                </button>
                            </li>
                        {/if}
                    {/each}

                    <li class="page-item" class:disabled={page === pageCount}>
                        <button type="button" class="page-link" aria-label="Página siguiente" onclick={() => go(page + 1)}>
                            <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                        </button>
                    </li>
                </ul>
            </nav>
        {/if}

        {#if onPageSize}
            <label class="d-flex align-items-center gap-2 text-body-secondary small mb-0">
                Por página
                <select
                    class="form-select form-select-sm w-auto"
                    value={pageSize}
                    onchange={(e) => onPageSize(Number(e.currentTarget.value))}
                >
                    {#each PAGE_SIZES as size (size)}
                        <option value={size}>{size}</option>
                    {/each}
                </select>
            </label>
        {/if}
    </div>
{/if}
