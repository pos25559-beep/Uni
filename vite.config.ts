import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
          if (id.includes('@azure/msal-browser')) return 'vendor-msal'
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/zustand/')
          ) {
            return 'vendor-react'
          }
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          if (id.includes('motion')) return 'vendor-motion'
          if (id.includes('@onboardjs') || id.includes('driver.js')) return 'vendor-onboarding'
          if (id.includes('pdf-lib')) return 'vendor-pdf'
          if (id.includes('katex')) return 'vendor-math'
          if (id.includes('lucide-react')) return 'vendor-icons'
          return undefined
        },
      },
    },
  },
})
