# Gestión de voces en Fish Audio — investigación para las issues #3 y #4

Verificado el **2026-09-11** contra el OpenAPI en vivo (`https://docs.fish.audio/api-reference/openapi.json`)
y el código publicado de los SDK oficiales. Lo que no aparece en fuente oficial está marcado
como **NO CONFIRMADO**: no rellenar esos huecos a ojo.

- Base URL: `https://api.fish.audio`. Los endpoints de modelos **no llevan prefijo `/v1`**.
- Auth: `Authorization: Bearer $FISH_API_KEY`.
- SDK que usa este proyecto: `fish-audio@0.1.0` (npm, oficial, publicado 2026-03-10 — es la última).

---

## 1. Resumen ejecutivo

| Pregunta | Respuesta |
|---|---|
| ¿Se puede renombrar una voz? (issue #3) | **Sí.** `PATCH /model/{id}` con `title`. El SDK ya lo expone como `client.voices.update()`. |
| ¿Qué más se puede editar? | Solo 5 campos: `title`, `description`, `cover_image`, `visibility`, `tags`. |
| ¿Se puede cambiar el audio de una voz ya creada? | **No.** Hay que crear otra y borrar la vieja. |
| ¿Qué opciones extra hay al crear? (issue #4) | `description`, `tags`, `cover_image`, `texts`, `visibility`, `enhance_audio_quality`, `generate_sample`, `voice_design_signatures`. |
| ¿Se puede publicar una voz por API? | **No en la creación**: `visibility=public` se degrada a `private`. En `PATCH` la doc se contradice — **NO CONFIRMADO**. |

---

## 2. Endpoints de modelos de voz

Rutas existentes en el spec: `/model` (GET, POST) y `/model/{id}` (GET, PATCH, DELETE). No hay más.

| Método | URL | Encoding | Respuesta |
|---|---|---|---|
| POST | `/model` | multipart/form-data (también json, urlencoded, msgpack) | 201 + `ModelEntity` |
| GET | `/model` | query params | 200 + `{total, items, has_more, …}` |
| GET | `/model/{id}` | — | 200 + `ModelEntity` |
| PATCH | `/model/{id}` | json / multipart / urlencoded / msgpack | 200 (schema **no declarado** en el spec) |
| DELETE | `/model/{id}` | — | 200, **cuerpo vacío** |

### 2.1 Crear — `POST /model`

| Campo | Tipo | Oblig. | Default | Límites / valores |
|---|---|---|---|---|
| `type` | const string | **Sí** | — | únicamente `tts` |
| `title` | string | **Sí** | — | sin `maxLength` declarado |
| `train_mode` | const string | **Sí** | — | únicamente `fast` |
| `voices` | binario o array | **Sí** | — | **1 a 20 ficheros** |
| `visibility` | enum | No | **`private`** | `public` \| `unlist` \| `private` |
| `description` | string \| null | No | `null` | — |
| `cover_image` | binario \| null | No | `null` | **requerido si el modelo es público** |
| `texts` | string o array \| null | No | `null` | **máx. 20**, mismo orden que `voices`; si falta se hace ASR |
| `tags` | string o array \| null | No | — | sin límite declarado |
| `enhance_audio_quality` | boolean | No | **`true`** | quita ruido y normaliza antes de entrenar |
| `generate_sample` | boolean | No | `false` | genera una muestra con el texto por defecto |
| `voice_design_signatures` | string o array \| null | No | `null` | firmas de candidatos de Voice Design, una por voz en el mismo orden |

> **Ojo con `visibility`.** Texto literal del spec: *"Public requests are downgraded to private;
> use the web publish flow to publish publicly."* El default **ya no es `public`** como en versiones
> anteriores de la API.

> **`train_mode` es `const: "fast"`**: el fine-tune (`full`) **ya no se puede lanzar por API**.
> El valor `full` solo sobrevive como valor de lectura en `ModelEntity`, para modelos antiguos.

```bash
curl --request POST https://api.fish.audio/model \
  --header "Authorization: Bearer $FISH_API_KEY" \
  --form "type=tts" \
  --form "train_mode=fast" \
  --form "title=Mi Voz" \
  --form "description=Clonada de una muestra de estudio" \
  --form "visibility=private" \
  --form "voices=@muestra1.wav" \
  --form "voices=@muestra2.wav" \
  --form "texts=Transcripcion de la muestra 1." \
  --form "texts=Transcripcion de la muestra 2." \
  --form "tags=es" \
  --form "tags=narracion" \
  --form "enhance_audio_quality=true"
```

### 2.2 Listar — `GET /model`

| Parámetro | Tipo | Default | Notas |
|---|---|---|---|
| `page_size` | int | `10` | **máx. 100** |
| `page_number` | int | `1` | |
| `title` | string | `null` | filtro por título |
| `tag` | string o array | `null` | |
| `self` | bool | `false` | modelos del workspace activo |
| `author_id` | string | `null` | ignorado si `self=true` |
| `language` | string o array | `null` | |
| `title_language` | string o array | `null` | |
| `licensed` | bool | `false` | solo voces con derechos asegurados por Fish Audio; ignorado si `self=true` |
| `sort_by` | enum | `score` | `score` \| `task_count` \| `created_at` |

Respuesta: `{total, items, has_more, total_is_exact, window_limited, max_offset, accessible_upper_bound}`.
`max_offset` observado en vivo: `10000` (techo de paginación profunda).

### 2.3 Editar — `PATCH /model/{id}`

**No existe `PUT`.** El body es obligatorio, pero ningún campo individual lo es: solo cambia lo que envías.

| Campo | Tipo | Notas |
|---|---|---|
| `title` | string \| null | el "nombre" de la voz → **issue #3** |
| `description` | string \| null | |
| `cover_image` | binario \| null | requiere multipart |
| `visibility` | enum \| null | `public` \| `unlist` \| `private` |
| `tags` | string o array | aquí **no** admite `null`, a diferencia del resto |

No se pueden tocar: los audios (`voices`), `texts`, `train_mode`, `type`, `enhance_audio_quality`,
`default_text`, `languages`, ni nada de solo lectura (`state`, `source`, contadores, campos PVC).

```bash
curl --request PATCH https://api.fish.audio/model/$MODEL_ID \
  --header "Authorization: Bearer $FISH_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{"title":"Titulo actualizado","visibility":"unlist","tags":["es","narracion"]}'
```

El spec **no declara el cuerpo del 200 de PATCH** → releer con `GET /model/{id}` después.
Si `ModelEntity.lock_visibility` es `true`, el cambio de visibilidad está bloqueado.

### 2.4 Borrar — `DELETE /model/{id}`

200 con cuerpo vacío. El spec no declara 404.
Excepción: **los PVC terminados no se pueden borrar** (limitación declarada por Fish Audio).

---

## 3. `ModelEntity` — campos devueltos

Obligatorios: `_id`, `type`, `title`, `state`, `tags`, `created_at`, `updated_at`, `visibility`,
`like_count`, `mark_count`, `shared_count`, `task_count`, `author`.

| Campo | Valores / notas |
|---|---|
| `_id` | úsalo como `reference_id` en `/v1/tts` |
| `type` | `svc` \| `tts` |
| `description`, `default_text` | string, default `""` |
| `cover_image` | ruta **relativa** (p. ej. `coverimage/<hash>`), no URL absoluta |
| `train_mode` | `fast` \| `full` (lectura) |
| `state` | `created` \| `training` \| `trained` \| `failed` |
| `samples` | `SampleEntity[]` = `{title, text, task_id, audio}` |
| `languages` | detectado automáticamente, no se envía al crear |
| `visibility`, `lock_visibility` | |
| `dmca_taken_down`, `takedown_category` | `dmca` \| `policy` |
| `source` | `api`, `voice_design`, … |
| `licensed` | derechos asegurados por Fish Audio |
| `pvc_release_state` y demás `pvc_*` | Professional Voice Clone |
| `quality` | `{audios: [{filename, duration_ms, language, quality, quality_passed, quality_reason}], …}` |
| `like_count`, `mark_count`, `shared_count`, `task_count` | contadores — ver §6 |
| `liked`, `marked`, `unliked` | relativos al usuario autenticado (`unliked` no está documentado) |
| `author` | `{_id, nickname, avatar}` |

**Bug latente en el proyecto**: `frontend/src/lib/types.ts` tipa `samples` como objeto único, cuando
es un **array** (`SampleEntity[]`). Viene heredado del tipado del SDK.

---

## 4. Modos de creación de voz (hoy hay tres)

| | **IVC (instant)** | **PVC (professional)** | **Voice Design** |
|---|---|---|---|
| Entrada | desde ~10 s de audio | 10–180 min de audio limpio | una descripción de texto |
| Formatos | `.wav`, `.mp3`, `.m4a`, `.opus` | MP3, WAV, FLAC | — |
| Entrenamiento | ~1 min | 1–2 h | ~15 s |
| Por API | **Sí** (`POST /model`, `train_mode=fast`) | **No**, solo web | **Sí** (`POST /v1/voice-design`) |
| Verificación | — | lectura en vivo del titular, obligatoria | — |
| Coste | sin línea de facturación propia | consume un *slot* del plan | 0,01 USD por petición |

Slots PVC por plan: Free 0 · Plus 1 · Pro 5 · Max 15. **NO CONFIRMADO**: el máximo de voces IVC por cuenta.

### Requisitos del audio de referencia (IVC)

- 1 a 20 ficheros. Mínimo recomendado ≥10 s por clip; óptimo 2–3 clips de 15–20 s, o 1–2 min en total.
- Mono, un solo hablante, volumen y tono estables, pausas de ~0,5 s. Evitar música, reverb y voces solapadas.
- `texts` es opcional: sin él se hace ASR, pero aportarlo afina la pronunciación.
- **NO CONFIRMADO**: tamaño máximo en MB, duración máxima, `maxLength` de título/descripción,
  número máximo de tags y formatos aceptados para `cover_image`. No están publicados en ningún sitio.

### Alternativa sin crear modelo

`POST /v1/tts` con `references: [{audio, text}]` y `Content-Type: application/msgpack`:
clonación one-shot, sin persistencia y sin consumir slots.

---

## 5. Voice Design — `POST /v1/voice-design`

Header obligatorio `model: voice-design-1`. Solo JSON (`additionalProperties: false`).
**Ningún SDK oficial lo envuelve**: hay que llamar a la REST a mano.

| Campo | Tipo | Default | Restricciones |
|---|---|---|---|
| `instruction` | string | **requerido** | 1–2000 caracteres |
| `reference_text` | string \| null | `null` | `maxLength: 150` en el OpenAPI (la guía dice 300 — usar 150) |
| `language` | string \| null | `null` | hint: `en`, `zh`, `ja`… |
| `n` | int | `2` | 1–4 candidatos |
| `speed` | number | `1` | `>0` y `<=3` |
| `num_step` | int | `32` | 1–128 (pasos de difusión) |
| `guidance_scale` | number | `2` | `>=0` |
| `instruct_guidance_scale` | number | `0` | `>=0` |
| `seed` | int \| null | `null` | determinista |

Respuesta: `{candidates: [{id, index, audio_base64, sample_rate, duration_ms, text, instruct, language}]}`.
Es stateless y síncrono; se factura **una vez por petición**, no por candidato.

**Convertir un candidato en voz permanente**: no hay endpoint de "guardar". Se decodifica el
`audio_base64` a WAV y se sube a `POST /model` en `voices`, pasando la firma en `voice_design_signatures`.

> ⚠️ **NO CONFIRMADO / hueco en la doc**: el schema `VoiceDesignCandidate` **no expone ningún campo
> `signature`**, y "signature" no aparece en ninguna otra parte del OpenAPI. No se sabe de dónde sale
> ese valor. Hay que inspeccionar la respuesta JSON cruda en runtime.
> **Vía alternativa que sí funciona**: `voice_design_signatures` es opcional, así que se puede subir el
> WAV del candidato como una clonación IVC normal. El modelo simplemente no llevará `source=voice_design`.

---

## 6. El contador de generaciones (`task_count`)

Definición oficial, una sola frase del SDK Python: *"Number of times the model has been used for generation"*.
El OpenAPI **no lleva ninguna `description`** para este campo.

**No está documentado**: si se incrementa al generar por API con `reference_id`, si la visibilidad
(`private`/`unlist`/`public`) afecta, ni si hay caché o retraso. Tampoco hay reportes públicos del problema.

Pista: `task_count` es uno de los valores de `sort_by` del catálogo público, lo que encaja con que sea
una métrica de popularidad — y por tanto con la hipótesis de que en `private` no se mantenga.
Sigue siendo **hipótesis, no hecho**.

**No existe ningún endpoint de historial** (`/task`, `/history`, `/usage`, `/generations`). Solo hay
agregados de cuenta: `GET /wallet/self/api-credit` y `GET /wallet/self/package`. El desglose de uso
está únicamente en la web: `https://fish.audio/app/usage`.

### Cómo comprobarlo empíricamente

```bash
# 1. baseline — directo y vía listado (si difieren, hay caché en el índice de búsqueda)
curl -sS "https://api.fish.audio/model/$MODEL_ID" -H "Authorization: Bearer $FISH_API_KEY" \
  | jq '{title, visibility, task_count, updated_at}'
curl -sS "https://api.fish.audio/model?self=true&page_size=100" -H "Authorization: Bearer $FISH_API_KEY" \
  | jq '.items[] | {title, visibility, task_count}'

# 2. generar 5 veces (5, no 1, para distinguir un incremento real de un +1 accidental)
for i in 1 2 3 4 5; do
  curl -sS -X POST https://api.fish.audio/v1/tts \
    -H "Authorization: Bearer $FISH_API_KEY" -H "Content-Type: application/json" -H "model: s2.1-pro" \
    -d "{\"text\":\"Prueba de contador numero $i.\",\"reference_id\":\"$MODEL_ID\",\"format\":\"mp3\"}" \
    -o "/tmp/probe_$i.mp3" -w "req $i -> HTTP %{http_code}\n"
done

# 3. releer al momento, a los 5 min y a las 24 h
curl -sS "https://api.fish.audio/model/$MODEL_ID" -H "Authorization: Bearer $FISH_API_KEY" \
  | jq '{task_count, updated_at}'
```

Control: repetir sobre una segunda voz puesta en `unlist`. Si esa sí incrementa y la `private` no,
la hipótesis queda confirmada. Contrastar en paralelo `GET /wallet/self/api-credit` antes y después
para verificar que las generaciones sí se facturan (es decir, que el fallo es solo del contador de
exhibición, no de que las peticiones no se registren).

---

## 7. SDK `fish-audio@0.1.0` (el que usamos)

```ts
// LISTAR -> GET /model
client.voices.search(request?: ModelListRequest): Promise<ModelListResponse>
// OBTENER -> GET /model/{id}
client.voices.get(voiceId: string): Promise<ModelEntity>
// EDITAR -> PATCH /model/{id}  (multipart)
client.voices.update(voiceId: string, request: UpdateModelRequest): Promise<{status: string}>
// BORRAR -> DELETE /model/{id}
client.voices.delete(voiceId: string): Promise<{status: string}>
// CREAR -> POST /model  (multipart)
client.voices.ivc.create(request: ModelCreateRequest): Promise<ModelEntity>

interface ModelCreateRequest {
  type?: 'tts'; title: string; train_mode?: 'fast'; voices: File[];
  visibility?: 'public' | 'unlist' | 'private'; description?: string;
  cover_image?: File; texts?: string[]; tags?: string[]; enhance_audio_quality?: boolean;
}
interface UpdateModelRequest {
  title?: string; description?: string; cover_image?: File;
  visibility?: 'public' | 'unlist' | 'private'; tags?: string[];
}
```

`RequestOptions` acepta `timeoutInSeconds`, `maxRetries` (default 2), `abortSignal`, `apiKey`,
`queryParams`, `headers`.

**Lo que el SDK JS no cubre** (requiere REST a mano): Voice Design, `voice_design_signatures`,
`generate_sample`, y `title_language` como array. Los métodos `share`, `getShared` y
`findSimilarVoices` están comentados en el repo, sin publicar.

---

## 8. Publicar una voz: implicaciones legales

Antes de añadir un selector de visibilidad al formulario, conviene saberlo:

- Fish Audio exige (en su guía de buenas prácticas, no en el contrato) **permiso por escrito** del
  titular de la voz. Nunca voces sacadas de internet ni de figuras públicas sin permiso.
- **Publicar como `public` concede a Fish.Audio una licencia "royalty-free, perpetual, sublicensable,
  irrevocable and worldwide"**, incluyendo uso en marketing y promoción. Al borrar la cuenta, los
  *Public User Submissions* "may remain fully available". Con `private` y `unlist` la licencia es
  mucho más estrecha.
- Los ToU prohíben presentar contenido generado por IA como enteramente humano.

Dado esto y que `public` está bloqueado por API en la creación, lo sensato para el formulario es
ofrecer `private` (default) y `unlist`, y dejar la publicación para la web.

---

## 9. Modelos TTS vigentes

Enum del header `model` en `/v1/tts` y `/v1/tts/live`:
`s1 | s2-pro | s2.1-pro | s2.1-pro-free | drama-3-preview`. Default del servidor: `s2.1-pro`.

| Modelo | Idiomas | Expresividad | Notas |
|---|---|---|---|
| `s2.1-pro` | 83 | `[bracket]` libre | recomendado; multi-speaker; garantías TTFA/DPA |
| `s2.1-pro-free` | 83 | `[bracket]` libre | mismo modelo, 0 USD, sin garantías, fair-use |
| `s2-pro` | 80+ | `[bracket]` libre | generación anterior, open source |
| `s1` | 13 | `(parentesis)`, etiquetas fijas | legacy |
| `drama-3-preview` | ? | ? | **NO CONFIRMADO**: aparece en el enum pero no en docs, precios ni changelog |

Una voz clonada se usa igual que cualquier otra: su `_id` como `reference_id`, sin restricción de modelo
declarada. El multi-speaker (`reference_id` array + `<|speaker:N|>`) requiere `s2-pro` o familia S2.1-Pro.

Precios: `s1`/`s2-pro`/`s2.1-pro` 15 USD por millón de bytes UTF-8 · `s2.1-pro-free` 0 USD ·
`transcribe-1` 0,36 USD/hora · `voice-design-1` 0,01 USD/petición. Crear un modelo IVC no factura.

Rate limits **por concurrencia**, no por QPS: Starter 5 · Elevated (≥100 USD) 15 · High Volume (≥1000 USD) 50.

---

## 10. Puntos de extensión en este repo

| Ampliación | Dónde tocar |
|---|---|
| Campos extra al clonar | `backend/routes/voices.ts:37-44` · `frontend/src/lib/CloneVoiceForm.svelte` · `frontend/src/App.svelte:63-76` (FormData) |
| Renombrar / editar voz (#3) | Falta todo: `PATCH /api/voices/:id` → `client.voices.update()`, y modo edición en `VoiceCard.svelte` |
| Paginación y búsqueda server-side | `backend/routes/voices.ts:13` (pasar `ModelListRequest`) |
| Validación de audio (1–20 ficheros, formatos) | `backend/routes/voices.ts:5` (opciones de multer) y `:31-34` |
| Tipado de `samples` como array | `frontend/src/lib/types.ts` |

---

## 11. Discrepancias entre fuentes oficiales

Documentadas para que nadie las "arregle" asumiendo un dato u otro:

1. **`visibility: public` en `PATCH`**: `POST /model` dice que se degrada a `private`;
   `features/manage-voices` afirma que `update` sí puede publicar. Sin resolver.
2. **`reference_text` de Voice Design**: OpenAPI dice 150 caracteres, la guía dice 300. Manda el spec.
3. **Idiomas de clonación**: la landing comercial dice 13 (cifra de S1), la doc técnica 83 para S2.1-Pro.
4. **`VoiceDesignCandidate` sin campo `signature`** pese a que `POST /model` lo pide.
5. **Changelog desactualizado**: la última entrada es "Fish Audio S2 — March 2026", sin entradas para
   S2.1-Pro ni PVC pese a estar en producción. No sirve como fuente de novedades.
6. **`drama-3-preview`** en el enum sin documentación alguna.

**Trampa de packaging (Python)**: el paquete PyPI `fishaudio` **no es de Fish Audio**; el oficial es
`fish-audio-sdk` (v1.3.0), que es el que instala el módulo `fishaudio`. En JS el oficial es `fish-audio`.

---

## Fuentes

- [OpenAPI oficial](https://docs.fish.audio/api-reference/openapi.json) — fuente canónica
- [Voice Cloning](https://docs.fish.audio/features/voice-cloning) · [Voice Design](https://docs.fish.audio/features/voice-design) · [Manage Voices](https://docs.fish.audio/features/manage-voices)
- [Create Model](https://docs.fish.audio/api-reference/endpoint/model/create-model) · [Update Model](https://docs.fish.audio/api-reference/endpoint/model/update-model)
- [Voice Cloning Best Practices](https://docs.fish.audio/developer-guide/best-practices/voice-cloning)
- [Pricing & Rate Limits](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits) · [Models Overview](https://docs.fish.audio/developer-guide/models-pricing/models-overview)
- [Blog: Professional Voice Cloning (2026-06-15)](https://fish.audio/blog/professional-voice-cloning/) · [Terms of Use](https://fish.audio/terms/)
- [github.com/fishaudio/fish-audio-typescript](https://github.com/fishaudio/fish-audio-typescript) · [github.com/fishaudio/fish-audio-python](https://github.com/fishaudio/fish-audio-python)
