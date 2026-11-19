import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

/** Site de apresentação da Unipedia (pasta site/), publicado como 2.º site do Firebase Hosting. */
export default defineConfig({
  root: fileURLToPath(new URL('./site', import.meta.url)),
  publicDir: 'public',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@app': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5174, host: '0.0.0.0', strictPort: true },
  preview: { port: 4174 },
  build: {
    outDir: fileURLToPath(new URL('./dist-site', import.meta.url)),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // O 3D fica no chunk lazy do hero; aqui só se separa o que a página toda usa.
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
          if (/node_modules\/(motion|motion-dom|motion-utils|framer-motion)\//.test(id)) return 'vendor-motion'
          return undefined
        },
      },
    },
  },
})
