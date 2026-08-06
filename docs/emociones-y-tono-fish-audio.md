# Control de emociones, tono y continuidad en Fish Audio TTS

> Notas de investigación recopiladas de la documentación oficial de Fish Audio, blogposts oficiales, GitHub y benchmarks técnicos. Fecha de investigación: 2026-08-06.

## 1. Dos sintaxis distintas según el modelo

| Modelo | Sintaxis | Tags |
|---|---|---|
| **S1 / S1-mini** (legacy) | `(paréntesis)` | Lista fija y cerrada de tags predefinidos |
| **S2 / S2-Pro / S2.1-Pro** (actual) | `[corchetes]` | Lenguaje libre en lenguaje natural — no limitado a una lista fija |

En S2, no hace falta memorizar un vocabulario cerrado: puedes escribir directamente cosas como `[professional broadcast tone]` o `[voz rota de haber llorado, intentando sonar normal]` y el modelo generaliza bien más allá de los ejemplos de entrenamiento (93.3% de "tag adherence" según su benchmark interno, Fish Instruction Benchmark).

## 2. Catálogo de emociones y tonos (S1/legacy, y también válidas como base en S2)

**Emociones básicas (24):** happy, sad, angry, excited, calm, nervous, confident, surprised, satisfied, delighted, scared, worried, upset, frustrated, depressed, empathetic, embarrassed, disgusted, moved, proud, relaxed, grateful, curious, sarcastic.

**Emociones avanzadas (25):** disdainful, unhappy, anxious, hysterical, indifferent, uncertain, doubtful, confused, disappointed, regretful, guilty, ashamed, jealous, envious, hopeful, optimistic, pessimistic, nostalgic, lonely, bored, contemptuous, sympathetic, compassionate, determined, resigned.

**Marcadores de tono/volumen:** `(in a hurry tone)`, `(shouting)`, `(screaming)`, `(whispering)`, `(soft tone)`, `[emphasis]` (justo antes de la palabra a enfatizar).

**Efectos sonoros/respiración:** `[sigh]`, `[gasp]`, `[inhale]`/`[exhale]`, `[panting]`, `[clears throat]`, `[laughing]`, `[chuckling]`, `[giggle]`, `[sobbing]`, `[crying]`, `[groan]`, `[yawning]`, `[snoring]`.

**Pausas:** `[pause]` / `[short pause]` / `[long pause]` / `[break]` / `[long-break]`.

**Intensificadores:** se pueden combinar con modificadores — `[slightly sad]`, `[very excited]`, `[extremely angry]`.

## 3. Reglas de colocación (lo que aconseja la documentación)

- **Emoción/estilo de frase completa** → mejor al **principio** de la frase.
- **Tono, énfasis y efectos de sonido** → pueden ir en cualquier posición; el tag afecta a todo lo que sigue hasta el próximo tag o fin de frase.
  - `[whispering] No quería entrar.` y `No quería entrar [whispering] a esa casa.` son ambos válidos — cambia el alcance.
- **Máximo ~3 emociones combinadas por frase** (recomendado), para evitar que compitan entre sí: `[sad][whispering] Te extraño tanto.`
- **Un tag descriptivo siempre necesita texto después** — si pones `[voz rota de llorar]` sin texto detrás, el resultado es impredecible.
- **Combina lo físico con lo emocional** para más naturalidad: `[panting][tired]` funciona mejor que `[panting]` solo.
- **Empieza simple y añade capas solo si falta algo** — el "over-tagging" genera efectos que se pisan entre sí.
- Los marcadores **no consumen tokens ni añaden latencia**, y funcionan en los 13 idiomas soportados.

## 4. Lo que dice la comunidad (GitHub issue #1280 en fishaudio/fish-speech)

Un usuario reportó que los tags entre corchetes en S2-Pro **funcionan débilmente o casi inaudibles cuando el texto es emocionalmente neutro** ("La reunión empieza a las tres") pero funcionan claramente cuando el texto ya está semánticamente alineado con la emoción ("¡Qué día tan bonito!" + `[happy]`).

**Conclusión práctica de esto:** el tag *amplifica* la emoción del texto, no la *sobrescribe* del todo. El issue quedó cerrado sin respuesta oficial de "cómo forzarlo mejor", pero las prácticas recomendadas para forzar una emoción sobre texto neutro son:

- Reforzar con intensificadores (`[very happy]` en vez de `[happy]`).
- Apilar tags relacionados (emoción + tono de voz).
- Reescribir ligeramente el texto para que tenga carga semántica coherente con la emoción deseada (no depender solo del tag).

## 5. Control de entonación real vía parámetros de API (no solo tags de texto)

Además de los tags dentro del texto, la API expone parámetros de generación:

```json
{
  "text": "...",
  "reference_id": "voice_id",
  "prosody": { "speed": 1.0, "volume": 0 },
  "temperature": 0.7,
  "top_p": 0.7,
  "chunk_length": 200,
  "latency": "balanced",
  "normalize": true
}
```

- **`prosody.speed`** (0.5–2.0): velocidad de habla.
- **`prosody.volume`** (-20 a 20): volumen.
- **`temperature`** (default 0.7): más bajo = más determinista/estable; más alto = más variado y expresivo, pero menos predecible. Para entonación consistente, bajar temperature.
- **`top_p`** (default 0.7): nucleus sampling, afecta diversidad igual que temperature.
- **`repetition_penalty`**: >1.0 reduce sonidos repetitivos/artefactos.
- **`chunk_length`** (100–300, default 200): tamaño de buffer antes de sintetizar — valores bajos empiezan a sonar antes (mejor para streaming), valores altos dan más contexto para prosodia coherente en textos largos.
- **`latency`**: `"normal" | "balanced" | "low"` — balanced es el default, prioriza baja latencia al primer audio (~300ms).

## 6. Continuidad (mantener la misma voz/tono a lo largo de textos largos o múltiples llamadas)

Esto es lo más flojo en la documentación oficial — no hay un parámetro explícito de "seed" bien documentado ni un mecanismo dedicado a "continuidad narrativa". Lo que sí recomiendan:

- **Reutilizar el mismo `reference_id`** en todas las llamadas relacionadas (guardarlo una vez tras clonar la voz) — es la forma principal de garantizar consistencia de timbre entre requests.
- **Usar la misma pipeline** (voice cloning + TTS del mismo proveedor) en lugar de clonar en un sitio y sintetizar en otro — evitar el "transfer step" que pierde matices de la voz.
- Para textos largos, usar el modo **streaming** con `chunk_length` más generoso y `latency: "normal"` en vez de `"low"`, para que el modelo tenga más contexto por chunk y la prosodia no se corte de forma abrupta entre fragmentos.
- Para diálogos multi-hablante, S2 soporta **multi-speaker tags** directamente en el input, manteniendo timbre y prosodia consistentes por hablante dentro de la misma llamada — mejor que hacer llamadas separadas por hablante si necesitas coherencia entre turnos.
- Bajar `temperature`/`top_p` ayuda a que la voz no "derive" en variabilidad tonal entre frases distintas de un mismo texto largo.

## 7. Ejemplo de progresión emocional recomendado por la doc

```
[happy] Todo iba genial hasta ese momento.
[uncertain] Pero algo no se sentía bien.
[sad] Entonces recibí la noticia.
[hopeful] Aun así, decidí seguir adelante.
[determined] Y no me rendí.
```

## Fuentes

- [Emotion Control - Fish Audio Docs](https://docs.fish.audio/developer-guide/core-features/emotions)
- [Text to Speech - Fish Audio Docs (features)](https://docs.fish.audio/features/text-to-speech)
- [API Reference - Fish Audio JS SDK](https://docs.fish.audio/api-reference/sdk/javascript/api-reference)
- [Fish Audio S2: Fine-Grained AI Voice Control at the Word Level](https://fish.audio/blog/fish-audio-s2-fine-grained-ai-voice-control-at-the-word-level/)
- [Fish Audio Open-Sources S2](https://fish.audio/blog/fish-audio-open-sources-s2/)
- [Fish Audio S2-Pro: TTS con emoción controlada por lenguaje natural (DEV Community)](https://dev.to/gary_yan_86eb77d35e0070f5/fish-audio-s2-pro-a-tts-model-with-emotion-in-speech-controlled-with-natural-language-1e7n)
- [GitHub issue #1280 — bracket emotion control débil en texto neutro](https://github.com/fishaudio/fish-speech/issues/1280)
- [Fish Audio S2 Technical Report (arXiv)](https://arxiv.org/pdf/2603.08823)
