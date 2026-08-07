// Prompt basado en docs/emociones-y-tono-fish-audio.md (secciones 1-3).
import { Router } from 'express'
import OpenAI from 'openai'
import { deepSeek } from '../lib/deepseek-client.ts'

const EMOTION_TAGGING_BASE_RULES = `Tu única tarea es devolver el texto que te pasa el usuario EXACTAMENTE igual en su contenido, pero insertando marcadores de emoción/tono donde tenga sentido, siguiendo estas reglas:

- Si el texto ya trae marcadores de hablante ("<|speaker:0|>", "<|speaker:1|>", ...), no los toques ni los muevas: trata cada tramo de un hablante por separado y coloca los marcadores de emoción justo después del marcador de ese hablante.
- Si una frase es emocionalmente neutra, no la reescribas para forzar la emoción: en vez de eso, intensifica el marcador (p. ej. "muy triste" en vez de "triste") o combínalo con un marcador de tono relacionado.
- Si aparece una palabra rara, extranjera, un acrónimo, una marca o cualquier palabra que se deba leer tal cual y no de forma natural, ponla entre comillas dobles ("así"): el modelo de voz la pronuncia mejor así. Es la única excepción a la regla de no tocar el texto original.
- No añadas, quites ni reordenes palabras del texto original (salvo las comillas dobles de la regla anterior cuando haga falta). No traduzcas. No añadas markdown, explicaciones ni nada que no sea el texto final con los marcadores insertados.
- Devuelve solo el texto resultante, nada más.`

// "s1" es legacy y usa vocabulario cerrado entre paréntesis (§1 de los docs);
// el resto de la familia admite lenguaje natural libre entre corchetes.
const S1_TAG_CATALOG =
  'happy, sad, angry, excited, calm, nervous, confident, surprised, satisfied, delighted, scared, worried, upset, ' +
  'frustrated, depressed, empathetic, embarrassed, disgusted, moved, proud, relaxed, grateful, curious, sarcastic, ' +
  'disdainful, unhappy, anxious, hysterical, indifferent, uncertain, doubtful, confused, disappointed, regretful, ' +
  'guilty, ashamed, jealous, envious, hopeful, optimistic, pessimistic, nostalgic, lonely, bored, contemptuous, ' +
  'sympathetic, compassionate, determined, resigned, in a hurry tone, shouting, screaming, whispering, soft tone, break, long-break'

function buildEmotionTaggingSystemPrompt(model: string): string {
  const syntaxRules =
    model === 's1'
      ? `Este texto es para el modelo "s1" (legacy): los marcadores van entre PARÉNTESIS y solo puedes usar uno de este vocabulario cerrado, en inglés y tal cual: ${S1_TAG_CATALOG}. No inventes marcadores nuevos ni uses corchetes. Coloca un único tag al principio de cada frase o tramo que afecte, por ejemplo: "(happy) Todo iba genial hasta ese momento."`
      : `Los marcadores van entre CORCHETES y son lenguaje natural libre (no una lista cerrada), por ejemplo [happy], [whispering], [muy triste], [voz rota de haber llorado], [sarcastic] — escribe lo que haga falta, como una indicación a un actor de doblaje.
- Un marcador de emoción o estilo de frase completa va al PRINCIPIO de la frase que afecta.
- Marcadores de tono/volumen ([shouting], [whispering], [soft tone]), énfasis ([emphasis] justo antes de la palabra) o efectos ([sigh], [gasp], [laughing], [pause]) pueden ir en cualquier posición; afectan a todo lo que sigue hasta el próximo marcador o el final de la frase.
- Máximo ~3 marcadores combinados por frase, para que no compitan entre sí (ejemplo: [sad][whispering] Te extraño tanto.).
- Un marcador siempre necesita texto después; nunca lo dejes suelto al final sin nada que afecte.`

  return `Eres un asistente que prepara guiones para un modelo de texto a voz (Fish Audio).

${syntaxRules}

${EMOTION_TAGGING_BASE_RULES}`
}

const router = Router()

router.post('/api/enhance-text', async (req, res) => {
  if (!deepSeek) {
    res.status(503).json({ message: 'DeepSeek no está configurado en el backend (falta DEEPSEEK_API_KEY en backend/.env).' })
    return
  }

  const { text, context, model } = req.body ?? {}
  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ message: 'Falta el campo "text".' })
    return
  }

  const userContent =
    typeof context === 'string' && context.trim()
      ? `Contexto de la escena (solo para elegir mejor las emociones; no lo incluyas en tu respuesta): ${context.trim()}\n\nTexto a marcar:\n${text}`
      : text

  try {
    const completion = await deepSeek.chat.completions.create({
      model: 'deepseek-v4-flash',
      temperature: 0.4,
      messages: [
        { role: 'system', content: buildEmotionTaggingSystemPrompt(typeof model === 'string' ? model : 's2.1-pro') },
        { role: 'user', content: userContent },
      ],
    })

    const enhancedText = completion.choices[0]?.message?.content?.trim()
    if (!enhancedText) {
      res.status(502).json({ message: 'DeepSeek no ha devuelto ningún texto.' })
      return
    }
    res.json({ enhancedText })
  } catch (error) {
    console.error('Error llamando a DeepSeek:', error)
    const message = error instanceof OpenAI.APIError ? error.message : 'No se ha podido contactar con DeepSeek.'
    res.status(502).json({ message: `Error generando el texto con DeepSeek: ${message}` })
  }
})

export default router
