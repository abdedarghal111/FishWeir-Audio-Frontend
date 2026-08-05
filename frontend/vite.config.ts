import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  // fija la raíz en esta carpeta (frontend/) sin importar desde dónde se invoque
  // el comando `vite` — así solo hace falta un package.json en la raíz del repo.
  root: import.meta.dirname,
  plugins: [svelte()],
  server: {
    // en dev, el backend corre aparte (ver backend/); en producción el propio
    // backend sirve el build de frontend/dist, así que no hace falta CORS.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
