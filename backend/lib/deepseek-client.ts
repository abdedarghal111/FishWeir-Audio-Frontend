// DeepSeek expone una API compatible con OpenAI, así que basta con apuntar el
// SDK de OpenAI a su baseURL. Es opcional: sin API key, el frontend
// simplemente no muestra el botón de "Mejorar con IA".
import OpenAI from 'openai'

const deepSeekApiKey = process.env.DEEPSEEK_API_KEY
export const deepSeek = deepSeekApiKey ? new OpenAI({ apiKey: deepSeekApiKey, baseURL: 'https://api.deepseek.com' }) : null
