/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The SPA and API share one origin in development so Sanctum's session cookies work without CORS.
  const apiTarget = env.VITE_PROXY_TARGET ?? 'http://localhost:8000'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      // Fail instead of silently moving to 5174 when another dev server already has the port.
      strictPort: true,
      // File-change events don't cross Windows bind mounts into Docker, so poll there.
      watch: env.VITE_USE_POLLING === 'true' ? { usePolling: true, interval: 300 } : {},
      proxy: {
        '/api': { target: apiTarget, changeOrigin: false },
        '/sanctum': { target: apiTarget, changeOrigin: false },
        '/storage': { target: apiTarget, changeOrigin: false },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
    },
  }
})
