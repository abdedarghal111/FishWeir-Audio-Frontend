import { createWriteStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { Readable } from 'node:stream'
import { Router } from 'express'
import type { Backends } from 'fish-audio'
import { requireFishAudio, sendFishAudioError, type FishModel } from '../lib/fish-audio-client.ts'
import { generationsDir, generationsStore } from '../lib/generations-store.ts'

const router = Router()

router.post('/api/tts', async (req, res) => {
  const client = requireFishAudio(res)
  if (!client) return

  const {
    text,
    referenceId,
    model,
    voiceTitle,
    speed,
    volume,
    temperature,
    topP,
    chunkLength,
    normalize,
    latency,
    sampleRate,
  } = req.body ?? {}
  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ message: 'Falta el campo "text".' })
    return
  }

  // WAV sin comprimir: Fish Audio cobra por texto de entrada, no por salida.
  const format = 'wav' as const

  const prosody: { speed?: number; volume?: number } = {}
  if (typeof speed === 'number') prosody.speed = speed
  if (typeof volume === 'number') prosody.volume = volume

  try {
    const audio = await client.textToSpeech.convert(
      {
        text,
        reference_id: referenceId || undefined,
        format,
        ...(Object.keys(prosody).length > 0 ? { prosody } : {}),
        temperature: typeof temperature === 'number' ? temperature : undefined,
        top_p: typeof topP === 'number' ? topP : undefined,
        chunk_length: typeof chunkLength === 'number' ? chunkLength : undefined,
        normalize: typeof normalize === 'boolean' ? normalize : undefined,
        latency: latency === 'normal' || latency === 'balanced' ? latency : undefined,
        sample_rate: typeof sampleRate === 'number' ? sampleRate : undefined,
      },
      (model as FishModel as unknown as Backends) || undefined,
    )

    const id = randomUUID()
    const fileName = `${id}.${format}`
    await mkdir(generationsDir, { recursive: true })

    res.setHeader('Content-Type', 'audio/wav')
    // La respuesta es audio en crudo, no JSON: el id viaja en una cabecera
    // para que el frontend nombre el archivo al descargarlo.
    res.setHeader('X-Generation-Id', id)
    res.setHeader('Access-Control-Expose-Headers', 'X-Generation-Id')
    const nodeStream = Readable.from(audio)
    const fileStream = createWriteStream(path.resolve(generationsDir, fileName))
    nodeStream.pipe(res)
    nodeStream.pipe(fileStream)

    fileStream.on('finish', async () => {
      try {
        const { size } = await stat(path.resolve(generationsDir, fileName))
        const generations = await generationsStore.read()
        generations.unshift({
          id,
          createdAt: new Date().toISOString(),
          text,
          model: (model as string) || 's2.1-pro-free',
          referenceId: referenceId || undefined,
          voiceTitle: typeof voiceTitle === 'string' && voiceTitle ? voiceTitle : undefined,
          format,
          fileName,
          sizeBytes: size,
          speed: typeof speed === 'number' ? speed : undefined,
          volume: typeof volume === 'number' ? volume : undefined,
          temperature: typeof temperature === 'number' ? temperature : undefined,
          topP: typeof topP === 'number' ? topP : undefined,
          chunkLength: typeof chunkLength === 'number' ? chunkLength : undefined,
          normalize: typeof normalize === 'boolean' ? normalize : undefined,
          latency: latency === 'normal' || latency === 'balanced' ? latency : undefined,
          sampleRate: typeof sampleRate === 'number' ? sampleRate : undefined,
        })
        await generationsStore.write(generations)
      } catch (err) {
        console.error('No se ha podido guardar la metadata de la generación:', err)
      }
    })
    fileStream.on('error', (err) => {
      console.error('No se ha podido guardar en disco el audio generado:', err)
    })
  } catch (error) {
    sendFishAudioError(res, error, 'No se ha podido generar el audio con Fish Audio.')
  }
})

export default router
