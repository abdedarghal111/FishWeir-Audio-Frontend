<script lang="ts">
    let { label = 'Generando audio' }: { label?: string } = $props()

    // Las barras mantienen su ancho y es el número lo que se ajusta al contenedor, para que
    // no engorden en pantallas anchas. En px.
    const BAR_WIDTH = 4
    const BAR_GAP = 4

    // Velocidad de cada onda en px/s. Son dos superpuestas, en sentidos opuestos y con
    // periodos que no son múltiplos entre sí (1.4 s y 2.3 s, ver el CSS): así la combinación
    // tarda mucho en repetirse y la animación no se hace previsible.
    const CREST_SPEED = 340
    const SWELL_SPEED = 190

    let barsEl: HTMLDivElement
    let barCount = $state(0)
    let barsWidth = $state(0)

    // Se mide al montar, y el componente se monta en cada generación: no hace falta seguir
    // los cambios de tamaño de la ventana.
    $effect(() => {
        barsWidth = barsEl.clientWidth
        barCount = Math.max(1, Math.floor(barsWidth / (BAR_WIDTH + BAR_GAP)))
    })

    // Desorden reproducible: la parte decimal de un seno muy amplificado.
    function noise(i: number) {
        const x = Math.sin(i * 127.1) * 43758.5453
        return x - Math.floor(x)
    }

    let bars = $derived(
        Array.from({ length: barCount }, (_, i) => {
            const distance = i * (BAR_WIDTH + BAR_GAP)
            return {
                crestDelay: distance / CREST_SPEED,
                // Medido desde el extremo contrario, de ahí que esta onda viaje al revés.
                swellDelay: (barsWidth - distance) / SWELL_SPEED,
                // Vaivén largo (lomas) + salto barra a barra (relieve).
                height: 0.3 + 0.32 * Math.abs(Math.sin(i * 0.11)) + 0.38 * noise(i),
            }
        }),
    )

    let elapsed = $state(0)

    $effect(() => {
        const started = Date.now()
        const timer = setInterval(() => (elapsed = Math.floor((Date.now() - started) / 1000)), 250)
        return () => clearInterval(timer)
    })

    let formatted = $derived(`${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}`)
</script>

<div class="generating" role="status" aria-live="polite">
    <div class="small text-body-secondary mb-2">
        <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
        {label}... {formatted}
    </div>
    <div class="bars" bind:this={barsEl} style="--bar-width: {BAR_WIDTH}px" aria-hidden="true">
        {#each bars as bar, i (i)}
            <!-- Anidados porque sus scaleY se multiplican: dos animaciones sobre el mismo
                 elemento se pisarían la transformación. -->
            <span class="bar" style="--bar-height: {bar.height}; --crest-delay: {bar.crestDelay}s">
                <span class="swell" style="--swell-delay: {bar.swellDelay}s"></span>
            </span>
        {/each}
    </div>
</div>

<style>
    .generating {
        padding: 0.6rem 0.75rem;
        border: 1px solid var(--bs-border-color);
        border-radius: var(--bs-border-radius);
        background: var(--bs-secondary-bg);
    }
    .bars {
        display: flex;
        align-items: center;
        /* El sobrante de repartir el ancho se va a los huecos, así la fila llega al borde. */
        justify-content: space-between;
        width: 100%;
        height: 2.25rem;
    }
    .bar {
        flex: 0 0 auto;
        width: var(--bar-width);
        height: 100%;
        transform: scaleY(0.07);
        animation: crest 1.4s ease-in-out infinite;
        animation-delay: var(--crest-delay);
    }
    .swell {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 1rem;
        background: var(--bs-primary);
        transform: scaleY(0.6);
        animation: swell 2.3s ease-in-out infinite;
        animation-delay: var(--swell-delay);
    }
    /* La barra pasa la mayor parte del ciclo en reposo y sólo se levanta en un tramo corto:
       con el retardo por posición, ese tramo es la cresta que cruza la fila. Se anima scaleY
       y no `height` porque animar la altura provoca reflow en cada frame. */
    @keyframes crest {
        0%,
        42%,
        100% {
            transform: scaleY(0.07);
        }
        12% {
            transform: scaleY(var(--bar-height));
        }
        26% {
            transform: scaleY(calc(var(--bar-height) * 0.3));
        }
    }
    @keyframes swell {
        0%,
        100% {
            transform: scaleY(0.55);
            opacity: 0.55;
        }
        50% {
            transform: scaleY(1);
            opacity: 1;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .bar,
        .swell {
            animation: none;
        }
        .bar {
            transform: scaleY(0.25);
        }
        .swell {
            transform: none;
        }
    }
</style>
