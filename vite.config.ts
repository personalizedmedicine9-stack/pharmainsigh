import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // ✅ هذا السطر السحري الذي يحل مشكلة html2pdf مع Vite
      'html2pdf.js': 'html2pdf.js/dist/html2pdf.bundle.min.js'
    }
  }
})