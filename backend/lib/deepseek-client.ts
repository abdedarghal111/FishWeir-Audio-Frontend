// Cliente de DeepSeek para la mejora de texto (opcional). DeepSeek expone una
// API compatible con la de OpenAI, así que basta con apuntar el SDK oficial
// de OpenAI a su baseURL.
//
// A diferencia de FISH_API_KEY, esta variable es opcional: si no está, los
// endpoints que la usan (ver routes/enhance-text.ts y routes/status.ts)
// responden "no disponible" y el frontend simplemente no muestra el botón de
// "Mejorar con IA".
import OpenAI from 'openai'

const deepSeekApiKey = process.env.DEEPSEEK_API_KEY
export const deepSeek = deepSeekApiKey ? new OpenAI({ apiKey: deepSeekApiKey, baseURL: 'https://api.deepseek.com' }) : null
