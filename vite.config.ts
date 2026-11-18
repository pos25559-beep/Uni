import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: false,
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('firebase/firestore') || id.includes('@firebase/firestore')) {
            return 'vendor-firebase-firestore'
          }
          if (id.includes('firebase/auth') || id.includes('@firebase/auth')) {
            return 'vendor-firebase-auth'
          }
          if (
            id.includes('firebase/ai') ||
            id.includes('@firebase/ai') ||
            id.includes('firebase/app-check') ||
            id.includes('@firebase/app-check')
          ) {
            return 'vendor-firebase-ai'
          }
          if (id.includes('firebase') || id.includes('@firebase')) return 'vendor-firebase-core'
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/') ||
            id.includes('node_modules/use-sync-external-store/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/zustand/')
          ) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/motion')) return 'vendor-motion'
          if (id.includes('node_modules/@onboardjs') || id.includes('node_modules/driver.js')) return 'vendor-onboarding'
          if (id.includes('node_modules/pdf-lib')) return 'vendor-pdf'
          if (id.includes('node_modules/katex')) return 'vendor-math'
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons'
          return undefined
        },
      },
    },
  },
})
