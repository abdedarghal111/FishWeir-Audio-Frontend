// Aviso sonoro al terminar una generación, sintetizado con WebAudio en vez de un fichero
// de audio: no añade peso al bundle ni depende de que el fichero esté ya descargado.

// Uno para toda la página: los navegadores limitan cuántos AudioContext se pueden crear.
let context: AudioContext | null = null

function getContext(): AudioContext | null {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) {
        return null
    }
    if (!context) {
        context = new Ctor()
    }
    // Nace "suspended" hasta que hay interacción; el aviso siempre viene de un click.
    if (context.state === 'suspended') {
        void context.resume()
    }
    return context
}

// Timbre de cada campanada. El 1.004 es la fundamental repetida unos cents más arriba: bate
// lentamente contra ella y es lo que da calidez, como dos cuerdas afinadas casi igual.
const PARTIALS = [
    { ratio: 0.5, gain: 0.2, decay: 1.1 },
    { ratio: 1, gain: 1, decay: 1.3 },
    { ratio: 1.004, gain: 0.45, decay: 1.2 },
    { ratio: 2, gain: 0.2, decay: 0.5 },
    { ratio: 2.99, gain: 0.04, decay: 0.18 },
]

const NOTES = [
    { freq: 1046.5, gain: 1, at: 0 },
    { freq: 1568, gain: 0.75, at: 0.13 },
]

function playPartial(ctx: AudioContext, destination: AudioNode, start: number, freq: number, gain: number, decay: number) {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()

    osc.type = 'sine'
    // Al golpear un metal la tensión inicial lo hace sonar unos cents más agudo.
    osc.frequency.setValueAtTime(freq * 1.004, start)
    osc.frequency.exponentialRampToValueAtTime(freq, start + 0.06)

    // Sin el ataque de 12 ms se oye un chasquido. La caída va a 0.0001 y no a 0 porque un
    // ramp exponencial no admite el cero.
    env.gain.setValueAtTime(0, start)
    env.gain.linearRampToValueAtTime(gain, start + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, start + decay)

    osc.connect(env).connect(destination)
    osc.start(start)
    osc.stop(start + decay + 0.05)
}

function playBell(ctx: AudioContext, destination: AudioNode, start: number, freq: number, gain: number) {
    for (const partial of PARTIALS) {
        playPartial(ctx, destination, start, freq * partial.ratio, gain * partial.gain, partial.decay)
    }
}

export function playNotifySound() {
    const ctx = getContext()
    if (!ctx) {
        return
    }
    const now = ctx.currentTime + 0.02

    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 3600
    tone.Q.value = 0.5

    const master = ctx.createGain()
    master.gain.value = 0.1

    tone.connect(master).connect(ctx.destination)

    for (const note of NOTES) {
        playBell(ctx, tone, now + note.at, note.freq, note.gain)
    }
}
