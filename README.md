# Fish Audio Frontend

<p align="center">
    <img src="./.github/images/logo.png" alt="App icon" width="200">
</p>

<p align="center">
    <a href="#qué-es-esto">Qué es esto</a> ·
    <a href="#funcionalidades">Funcionalidades</a> ·
    <a href="#tecnologías-usadas">Tecnologías usadas</a> ·
    <a href="#modo-de-uso">Modo de uso</a> ·
    <a href="#estructura">Estructura</a>
</p>

## Qué es esto

Un frontend con un pequeño backend propio que hace de intermediario con la API de [Fish Audio](https://fish.audio). Generas el audio y él se encarga de guardarlo todo (voces, historial, favoritos) para que puedas trabajar a tu ritmo, exportar a distintos formatos y tener el control de lo que pasa en cada momento, todo desde tu propio escritorio y sin complicarte con peticiones sueltas. Además, incluye una IA que mejora el texto que escribes añadiéndole las emociones que le indiques, para que el audio generado suene más realista.

Es un proyecto nacido de una necesidad personal, no pensado para ser un producto escalable, sin capas ni abstracciones de más, una herramienta rápida. También es una forma de apoyar el open source y las APIs que cobran de forma barata y transparente: Fish Audio me pareció un coste razonable además de que permite un modelo gratuito para pruebas.

Se ha desarrollado con ayuda de IA agéntica para ir más rápido, con revisión y supervisión humana en todo momento (como cualquier desarrollo profesional de hoy en día).

## Funcionalidades

- Generar audio a partir de texto (texto a voz), eligiendo modelo, voz clonada opcional y parámetros avanzados de generación.
- Mejorar el texto con IA antes de generar, añadiendo marcadores de emoción y tono (requiere una API key de DeepSeek).
- Listar, crear (clonación instantánea a partir de audios de referencia) y eliminar tus voces clonadas.
- Guardar voces de otros autores por enlace o ID de fish.audio y usarlas igual que las propias.
- Marcar modelos y voces como favoritos para elegirlos rápido sin buscar en los selects.
- Guardar y consultar el historial de audios generados, con reproducción y descarga (wav o mp3 comprimido) y guardando todos los metadatos.

## Tecnologías usadas

- **Backend:** Node.js, Express 5, multer, SDK `fish-audio`, SDK `openai` (para DeepSeek), TypeScript.
- **Frontend:** Svelte 5, Vite, Bootstrap 5, Font Awesome, ffmpeg.wasm, TypeScript.
- **Gestor de paquetes:** pnpm.

## Modo de uso

1. Instala las dependencias:
   ```
   pnpm install
   ```
2. Configura las variables de entorno del backend:
   ```
   cp backend/.env.example backend/.env
   ```
   Y edita `backend/.env` con tu API key de [fish.audio/app/api-keys](https://fish.audio/app/api-keys) (y el puerto si quieres cambiarlo). También puedes añadir una API key de [DeepSeek](https://platform.deepseek.com/api_keys) (opcional) para activar el botón "Mejorar con IA".
3. Arranca todo en modo desarrollo (backend + frontend a la vez):
   ```
   pnpm dev
   ```
4. Para producción, compila el frontend y arranca el backend (que sirve el build):
   ```
   pnpm build
   pnpm start
   ```

Otros comandos útiles:
- `pnpm check:backend` — comprueba tipos del backend.
- `pnpm check:frontend` — comprueba tipos y el componente Svelte del frontend.

## Estructura

```
backend/    servidor Express + cliente Fish Audio (backend/server.ts)
frontend/   app Svelte (frontend/src/App.svelte)
docs/       guías de referencia (p. ej. emociones y tono para Fish Audio)
```
