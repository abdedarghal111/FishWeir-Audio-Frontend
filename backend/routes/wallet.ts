// Saldo de la cuenta de Fish Audio: crédito de prepago y cuota del plan contratado.
import { Router } from 'express'
import { fishAudioFetch, requireFishAudio, sendFishAudioError } from '../lib/fish-audio-client.ts'

const router = Router()

// `credit` llega como string decimal para no perder precisión.
type ApiCreditResponse = { credit: string }

// `total` y `balance` son unidades del plan (caracteres), no dinero.
type PackageResponse = { type: string; total: number; balance: number }

router.get('/api/fish-audio/wallet', async (_req, res) => {
    if (!requireFishAudio(res)) {
        return
    }

    try {
        // Una cuenta sin suscripción puede no tener paquete, y eso no debe ocultar el crédito.
        const [credit, pkg] = await Promise.all([
            fishAudioFetch('/wallet/self/api-credit', 'GET') as Promise<ApiCreditResponse>,
            (fishAudioFetch('/wallet/self/package', 'GET') as Promise<PackageResponse>).catch(() => null),
        ])

        // Sin esto, un `credit` ausente o no numérico se serviría como un saldo de 0 válido.
        const amount = Number(credit.credit)
        if (!Number.isFinite(amount)) {
            throw new Error(`Fish Audio devolvió un crédito no numérico: ${credit.credit}`)
        }

        res.json({
            credit: amount,
            package: pkg && { type: pkg.type, total: pkg.total, balance: pkg.balance },
        })
    } catch (error) {
        sendFishAudioError(res, error, 'No se ha podido consultar el saldo de Fish Audio.')
    }
})

export default router
