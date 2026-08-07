// DeepSeek expone una API compatible con OpenAI: basta con apuntar el SDK de
// OpenAI a su baseURL. La API key es opcional; sin ella no se muestra el botón "Mejorar con IA".
import OpenAI from 'openai'

const deepSeekApiKey = process.env.DEEPSEEK_API_KEY
export const deepSeek = deepSeekApiKey ? new OpenAI({ apiKey: deepSeekApiKey, baseURL: 'https://api.deepseek.com' }) : null
