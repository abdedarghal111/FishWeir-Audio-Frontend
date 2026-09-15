<!-- Barra de saldo de la pestaña Generar: crédito de prepago y cuota del plan. La API no
     devuelve el coste de cada petición, así que el gasto se deduce restando saldos. -->
<script module lang="ts">
    // Estado a nivel de módulo, como en TextPanel: el saldo no se reinicia al cambiar de pestaña.
    import { errorMessage, type Wallet } from './types'

    // Debe coincidir con la duración de la animación en el CSS de abajo.
    const SPENT_ANIMATION_MS = 4500

    // Fish Audio no siempre descuenta al instante: se relee en estos tiempos hasta ver el cambio.
    const REFRESH_DELAYS_MS = [0, 1500, 4000]

    let wallet: Wallet | null = $state(null)
    let loading = $state(false)
    let loadError = $state('')

    // `id` permite que `{#key}` reinicie la animación cuando dos gastos coinciden en importe.
    let spent: { id: string; credit: number; chars: number } | null = $state(null)
    let spentTimer: ReturnType<typeof setTimeout> | null = null

    export async function loadWallet() {
        loading = true
        try {
            const res = await fetch('/api/fish-audio/wallet')
            if (!res.ok) {
                throw new Error(await errorMessage(res, `Error ${res.status}`))
            }
            wallet = await res.json()
            loadError = ''
        } catch (err) {
            loadError = err instanceof Error ? err.message : 'No se ha podido consultar el saldo'
        } finally {
            loading = false
        }
    }

    // La invocan generar audio y clonar voces. Clonar no factura según la documentación,
    // pero se relee igual por si esa condición cambiara.
    export async function registerSpend() {
        const before = wallet
        if (!before) {
            await loadWallet()
            return
        }

        for (const delay of REFRESH_DELAYS_MS) {
            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay))
            }
            await loadWallet()
            if (!wallet) {
                return
            }

            const credit = before.credit - wallet.credit
            const chars = (before.package?.balance ?? 0) - (wallet.package?.balance ?? 0)
            if (credit <= 0 && chars <= 0) {
                continue
            }

            if (spentTimer) {
                clearTimeout(spentTimer)
            }
            spent = { id: crypto.randomUUID(), credit, chars }
            spentTimer = setTimeout(() => (spent = null), SPENT_ANIMATION_MS)
            return
        }
    }
</script>

<script lang="ts">
    const USAGE_URL = 'https://fish.audio/app/usage'

    loadWallet()

    function formatUsd(value: number) {
        return `$${value.toFixed(4)}`
    }

    // El gasto de una generación puede ser de millonésimas: 6 decimales, sin ceros sobrantes.
    function formatSpentUsd(value: number) {
        return `$${value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`
    }

    function formatUnits(value: number) {
        return value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(value)
    }

    let pkg = $derived(wallet?.package ?? null)
    let usedPercent = $derived(pkg && pkg.total > 0 ? Math.round(((pkg.total - pkg.balance) / pkg.total) * 100) : 0)
    // El plan se consume antes que el crédito, así que el descuento puede darse en caracteres.
    let spentLabel = $derived(spent ? (spent.credit > 0 ? formatSpentUsd(spent.credit) : `${formatUnits(spent.chars)} car.`) : '')
</script>

<!-- Con saldo ya cargado, un fallo de relectura sólo marca un icono: la barra no desaparece. -->
{#if wallet}
    <div class="wallet-bar mb-3">
        <span class="wallet-item">
            <i class="fa-solid fa-coins text-warning" aria-hidden="true"></i>
            <span class="wallet-label">Crédito</span>
            <span class="credit-anchor fw-semibold" class:pulse={spent !== null}>
                {formatUsd(wallet.credit)}
                {#if spent}
                    {#key spent.id}
                        <span class="spent-float" aria-hidden="true">-{spentLabel}</span>
                    {/key}
                {/if}
            </span>
        </span>

        <span class="wallet-sep"></span>

        <span class="wallet-item flex-grow-1">
            <span class="wallet-label">Plan {pkg?.type ?? '—'}</span>
            <span class="wallet-progress flex-grow-1">
                <span class="wallet-progress-fill" style="width: {usedPercent}%"></span>
            </span>
            <span class="wallet-label">{usedPercent}%</span>
            <span class="fw-semibold">{pkg ? `${formatUnits(pkg.balance)} / ${formatUnits(pkg.total)}` : '—'}</span>
        </span>

        {#if loadError}
            <i class="fa-solid fa-triangle-exclamation text-danger" title={loadError}></i>
        {/if}
        <button type="button" class="btn-wallet" title="Actualizar saldo" disabled={loading} onclick={() => loadWallet()}>
            <i class="fa-solid fa-rotate" class:fa-spin={loading} aria-hidden="true"></i>
            <span class="visually-hidden">Actualizar saldo</span>
        </button>
        <a class="btn-wallet" href={USAGE_URL} target="_blank" rel="noreferrer" title="Ver el desglose de consumo en fish.audio">
            <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
            <span class="visually-hidden">Ver el consumo en fish.audio</span>
        </a>
    </div>
{:else if loadError}
    <p class="text-danger small mb-3">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        {loadError}
        <button type="button" class="btn btn-sm btn-link p-0 ms-1" onclick={() => loadWallet()}>Reintentar</button>
    </p>
{/if}

<style>
    .wallet-bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        min-height: 2.15rem;
        padding: 0.3rem 0.7rem;
        font-size: 0.82rem;
        background: var(--bs-secondary-bg);
        border-radius: var(--bs-border-radius);
    }

    .wallet-item {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        min-width: 0;
    }

    .wallet-label {
        color: var(--bs-secondary-color);
    }

    .wallet-sep {
        width: 1px;
        height: 1.1rem;
        background: var(--bs-border-color);
    }

    .wallet-progress {
        position: relative;
        height: 6px;
        min-width: 4rem;
        border-radius: 3px;
        background: var(--bs-border-color);
        overflow: hidden;
    }

    .wallet-progress-fill {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--bs-primary);
        transition: width 0.6s ease-out;
    }

    .btn-wallet {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.1rem 0.3rem;
        font-size: 0.78rem;
        line-height: 1;
        border: 0;
        border-radius: var(--bs-border-radius-sm);
        background: transparent;
        color: var(--bs-secondary-color);
    }
    .btn-wallet:hover {
        background: var(--bs-tertiary-bg);
        color: var(--bs-body-color);
    }
    .btn-wallet:disabled {
        opacity: 0.5;
    }

    .credit-anchor {
        position: relative;
        display: inline-block;
    }

    /* Sin font-size propio: hereda el del importe sobre el que flota. */
    .spent-float {
        position: absolute;
        left: 50%;
        bottom: 100%;
        white-space: nowrap;
        font-weight: 700;
        color: var(--bs-danger);
        text-shadow:
            1px 1px 0 var(--bs-body-bg),
            -1px 1px 0 var(--bs-body-bg),
            1px -1px 0 var(--bs-body-bg),
            -1px -1px 0 var(--bs-body-bg);
        pointer-events: none;
        animation: spent-float-up 4.5s ease-out forwards;
    }

    @keyframes spent-float-up {
        0% {
            transform: translate(-50%, 0);
            opacity: 0;
        }
        8% {
            transform: translate(-50%, -20px);
            opacity: 1;
        }
        70% {
            transform: translate(-50%, -20px);
            opacity: 1;
        }
        100% {
            transform: translate(-50%, -34px);
            opacity: 0;
        }
    }

    .pulse {
        animation: spent-pulse 0.6s ease-out;
    }

    @keyframes spent-pulse {
        0% {
            transform: scale(1);
            color: inherit;
        }
        35% {
            transform: scale(1.18);
            color: var(--bs-danger);
        }
        100% {
            transform: scale(1);
            color: inherit;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .spent-float,
        .pulse {
            animation-duration: 0.01ms;
        }
        .wallet-progress-fill {
            transition: none;
        }
    }
</style>
