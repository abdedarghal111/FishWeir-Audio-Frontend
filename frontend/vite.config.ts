import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
    // Fija la raíz en esta carpeta (frontend/) sin importar desde dónde se invoque
    // el comando `vite` — así solo hace falta un package.json en la raíz del repo.
    root: import.meta.dirname,
    plugins: [svelte()],
    optimizeDeps: {
        // ffmpeg.wasm carga su propio Worker + .wasm en tiempo de ejecución; si
        // Vite intenta pre-empaquetarlo en dev se rompe. Es la exclusión que
        // recomienda la propia documentación de @ffmpeg/ffmpeg para bundlers.
        exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    },
    server: {
        // en dev, el backend corre aparte (ver backend/); en producción el propio
        // backend sirve el build de frontend/dist, así que no hace falta CORS.
        proxy: {
            '/api': 'http://localhost:4000',
        },
    },
})
