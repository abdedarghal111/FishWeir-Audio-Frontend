---
name: fish-audio-voice-direction
description: Turn a user's request for emotion, tone, pacing, or a multi-speaker performance into the actual text sent to Fish Audio's TTS. Use whenever the user wants a Fish Audio generation to sound angry, sad, whispering, excited, sarcastic, etc.; asks how to make the voice more expressive, natural, or consistent; wants a dialogue between two cloned voices; or asks about emotion tags, [bracket] markers, prosody, or voice direction for Fish Audio. Targets the current default model, s2.1-pro (the S2.1-Pro family) — free-form natural-language bracket tags, not the old S1 fixed-tag syntax.
---

# Fish Audio — Voice Direction & Emotion Tags (S2.1-Pro)

This skill is about **what to put inside the `text` field** sent to Fish Audio TTS so the
generated audio matches what the user asked for — emotion, tone, pacing, pauses,
multi-speaker dialogue, and continuity across long passages. It complements (doesn't
replace) a skill about the raw HTTP/WebSocket mechanics of calling the API.

Default to **`s2.1-pro`** (the current production model, aliased across the S2.1-Pro
family) unless the user names a different model. `s2.1-pro-free` is the same model on
the free tier — same tag syntax, no TTFA/DPA guarantees. Only fall back to S1-style
`(parenthesis)` fixed tags if the user is explicitly targeting the legacy `s1` model.

## The core workflow

1. **Read the user's intent**, not just their literal words. "Que suene enfadada al
   final" → an emotion tag placed before the last sentence/clause, not the whole text.
   "Que hable como un locutor de radio" → a free-form style tag, not a fixed emotion.
2. **Pick tag(s)** from the catalog below, or write a free-form natural-language
   instruction in the same `[bracket]` syntax if nothing in the catalog fits exactly.
   S2.1-Pro is trained on open-ended descriptions, so novel tags generalize well —
   you are not limited to the examples in this file.
3. **Place the tag(s)** according to the rules in "Placement & scope" below.
4. **Check the neutral-text caveat**: if the surrounding sentence carries no emotional
   content of its own, a bare tag will sound weak. Reinforce it (see that section).
5. **Reach for API parameters** (not text tags) for things that are about *delivery
   mechanics* rather than *meaning*: overall speed/volume, stability vs. expressiveness,
   and consistency across a long text or across separate requests. See "Parameters
   that complement (not replace) tags" below.
6. **Keep it readable**: don't stack more tags than the sentence can carry. 2-3
   combined descriptors per sentence is the practical ceiling before they start
   competing with each other.

## Tag syntax

- **S2.1-Pro family (current, default)**: `[free-form text in English]`, inserted
  directly in `text`. Not a closed vocabulary — write it like a direction to a voice
  actor: `[professional broadcast tone]`, `[voice rough from crying, trying to sound
  normal]`, `[speaking slowly, almost hesitant]`, `[dead tired, end of a very long
  shift]`.
- **S1 (legacy only)**: `(parenthesis)` with a fixed tag name, e.g. `(happy)`,
  `(whispering)`. Only use this syntax if the request is explicitly for the `s1`
  model — it does not understand free-form descriptions.
- Either syntax lives inline in the `text` string itself. There is no separate
  "emotion" request field.

## Tag catalog (starting point, not a closed list)

**Emotions** — happy, sad, angry, excited, calm, nervous, confident, surprised,
satisfied, delighted, scared, worried, upset, frustrated, depressed, empathetic,
embarrassed, disgusted, moved, proud, relaxed, grateful, curious, sarcastic,
disdainful, anxious, hysterical, indifferent, uncertain, doubtful, confused,
disappointed, regretful, guilty, ashamed, jealous, envious, hopeful, optimistic,
pessimistic, nostalgic, lonely, bored, contemptuous, sympathetic, compassionate,
determined, resigned.

**Tone / delivery** — whispering, shouting, screaming, soft tone, in a hurry tone,
professional broadcast tone, low voice, loud voice. `[emphasis]` right before a word
or phrase stresses it.

**Breathing & reactions** — sigh, gasp, inhale, exhale, panting, clears throat,
laughing, chuckling, giggle, sobbing, crying, groan, yawning, snoring.

**Pacing** — `[pause]`, `[short pause]`, `[long pause]` / `[break]`, `[long-break]`.

**Intensity modifiers** — stack onto any tag: `[slightly sad]`, `[very excited]`,
`[extremely angry]`.

**Free-form style direction** — anything a director would say works too:
`[warm and caring]`, `[flat, deadpan delivery]`, `[reading like a bedtime story]`.

## Placement & scope

- A tag applies to everything **after it, until the next tag or the end of the
  sentence** — it is not just a one-word flourish.
- **Whole-sentence emotion/style** → place it at the **start** of that sentence:
  `[happy] Todo iba genial hasta ese momento.`
- **Tone, emphasis, and sound effects** → can go anywhere, including mid-sentence, to
  shift delivery partway through: `No quería entrar [whispering] a esa casa.`
- **Combine up to ~3 tags per sentence** before they start fighting each other:
  `[sad][whispering] Te extraño tanto.`
- **Pair a physical reaction with the emotion behind it** for more natural results:
  `[panting][tired]` reads better than `[panting]` alone.
- **Always follow a descriptive tag with actual text.** `[voice rough from crying]`
  with nothing after it produces unpredictable output — the tag needs speech to shape.
- **Start with one well-placed tag; add more only if the result is missing something.**
  Over-tagging a single sentence makes the effects blur together.
- For a **progression of emotion across a paragraph**, put one tag at the start of
  each sentence as the mood shifts:
  ```
  [happy] Todo iba genial hasta ese momento.
  [uncertain] Pero algo no se sentía bien.
  [sad] Entonces recibí la noticia.
  [hopeful] Aun así, decidí seguir adelante.
  [determined] Y no me rendí.
  ```

## The neutral-text caveat

Bracket tags **amplify the emotional content already implied by the text; they don't
fully override a semantically neutral sentence.** `[happy] What a beautiful day!` reads
clearly happy. `[happy] The meeting starts at three o'clock.` comes out only faintly
happier than flat, because nothing in the sentence itself supports the emotion.

When the user wants a strong emotion forced onto text that has no emotional content of
its own, do more than just add the tag:

1. **Intensify**: `[very happy]` / `[extremely happy]` instead of `[happy]`.
2. **Stack a related tag**: pair the emotion with a tone/delivery tag that reinforces it
   (`[happy][warm tone]`).
3. **Nudge the wording itself** so it semantically supports the emotion, instead of
   relying on the tag alone — e.g. add an exclamation, a short aside, or rephrase
   slightly, while preserving the user's meaning. This is the single most effective
   fix and should be the default move, not a last resort.

## Multi-speaker dialogue

The S2.1-Pro family (and `s2-pro`) support multiple voices in one request:

- Embed `<|speaker:0|>`, `<|speaker:1|>`, ... directly in `text` to mark whose turn it
  is: `<|speaker:0|>Good morning!<|speaker:1|>Good morning! How are you?`
- `reference_id` becomes an **array**, one voice model ID per speaker index, in the
  same order as the speaker tags: `["<speaker-0-id>", "<speaker-1-id>"]`.
- Emotion/tone tags work per-turn exactly as in single-speaker text — place them right
  after that speaker's tag: `<|speaker:0|>[annoyed] I already told you that.`
- Not supported on `s1` — dialogue requires `s2-pro` or an S2.1-Pro model.

## Parameters that complement (not replace) tags

Use these `TTSRequest` fields for things about *how* the voice performs mechanically,
not about *what* it should express — that stays in the text:

| Parameter | What it actually controls | When to reach for it |
| --- | --- | --- |
| `temperature` (0–1, default 0.7) | Randomness/expressiveness of delivery | Lower for a stable, predictable read; higher for more varied, lively delivery |
| `top_p` (0–1, default 0.7) | Sampling diversity, works alongside `temperature` | Tune together with `temperature`, rarely alone |
| `prosody.speed` (0.5–2, default 1) | Overall speaking speed | "Talk faster/slower" requests that apply to the whole clip, not one word — for a local speed change inside a sentence, prefer a tone tag like `[in a hurry tone]` instead |
| `prosody.volume` (dB, default 0) | Overall loudness | Whole-clip loudness, not per-word emphasis (`[emphasis]` is per-word) |
| `chunk_length` (100–300, default 300) / `min_chunk_length` (0–100, default 50) | How much text is batched before synthesizing | Long texts: a larger chunk gives the model more context per segment, which helps prosody stay coherent across sentences |
| `condition_on_previous_chunks` (bool, default true) | Whether each new chunk hears the previous one for continuity | Keep this `true` for long-form narration so tone/pacing doesn't reset every chunk |
| `reference_id` reused across calls | Voice identity consistency | Always reuse the same voice model ID across a series of requests (e.g. chapters of the same book) instead of re-resolving/re-cloning each time |
| `latency` (`low`/`normal`/`balanced`, default `normal`) | Latency vs. quality trade-off | Real-time/interactive use → `low` or `balanced`; narration/quality-first → `normal` |

**Continuity across a long piece or a series of requests** is mostly a parameter
concern, not a tag concern: keep `reference_id` identical, keep `condition_on_previous_chunks: true`, prefer a larger `chunk_length` so sentences aren't cut mid-thought, and avoid swinging `temperature`/`top_p` between requests in the same piece — that reads as the narrator's mood randomly shifting between chunks.

## Quick checklist for turning a request into text

- [ ] Did I identify *which part* of the text the requested emotion/tone applies to
      (all of it, the end, one clause)?
- [ ] Did I place the tag at the **start** of that span (whole-sentence) or **inline**
      (tone/emphasis/effect)?
- [ ] Is the tag alone enough, or does the sentence read as emotionally neutral and
      need reinforcement (intensity modifier, stacked tag, or reworded text)?
- [ ] Am I using at most ~3 combined tags per sentence?
- [ ] Does every descriptive tag have real text after it?
- [ ] If this is a dialogue: are `<|speaker:N|>` tags present and does `reference_id`
      have one entry per speaker in the same order?
- [ ] If this is long-form or a series of calls: same `reference_id`,
      `condition_on_previous_chunks: true`, and stable `temperature`/`top_p` across
      the whole piece?
- [ ] Am I on `s1`? If so, switch to fixed `(parenthesis)` tags — free-form
      `[bracket]` descriptions won't work on that model.

## Canonical sources

- `https://docs.fish.audio/developer-guide/core-features/emotions`
- `https://docs.fish.audio/api-reference/emotion-reference.md`
- `https://fish.audio/blog/fish-audio-s2-fine-grained-ai-voice-control-at-the-word-level/`
- `https://fish.audio/blog/fish-audio-open-sources-s2/`
