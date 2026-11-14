import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('firebase')) return 'vendor-firebase'
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          if (id.includes('motion')) return 'vendor-motion'
          if (id.includes('@onboardjs') || id.includes('driver.js')) return 'vendor-onboarding'
          if (id.includes('pdf-lib')) return 'vendor-pdf'
          if (id.includes('lucide-react')) return 'vendor-icons'
          return undefined
        },
      },
    },
  },
})
