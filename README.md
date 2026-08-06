# Fish Audio Frontend

## Índice

- [Qué es esto](#qué-es-esto)
- [Funcionalidades](#funcionalidades)
- [Tecnologías usadas](#tecnologías-usadas)
- [Modo de uso](#modo-de-uso)
- [Estructura](#estructura)

## Qué es esto

Una interfaz sencilla para generar audio con la API de [Fish Audio](https://fish.audio) sin tener que ir lanzando peticiones sueltas. Es un proyecto hecho por diversión y no pensado para ser un producto escalable: un backend mínimo de un solo archivo y un frontend de un solo componente, sin capas ni abstracciones de más. Funciona como una herramienta rápida para tener a mano, no como base para crecer.

Se ha desarrollado con ayuda de IA agéntica para ir más rápido, con revisión y supervisión humana en todo momento.

## Funcionalidades

- Generar audio a partir de texto (texto a voz), eligiendo modelo y voz clonada opcional.
- Listar, crear (clonación instantánea a partir de audios de referencia) y eliminar tus voces clonadas.
- Guardar voces de otros autores por enlace o ID de fish.audio y usarlas igual que las propias.
- Marcar modelos y voces como favoritos para elegirlos rápido sin buscar en los selects.

## Tecnologías usadas

- **Backend:** Node.js, Express 5, multer, SDK `fish-audio`, TypeScript.
- **Frontend:** Svelte 5, Vite, Bootstrap 5, TypeScript.
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
   Y edita `backend/.env` con tu API key de [fish.audio/app/api-keys](https://fish.audio/app/api-keys) (y el puerto si quieres cambiarlo).
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
```
