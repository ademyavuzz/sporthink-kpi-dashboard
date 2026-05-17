import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      // Playwright test çıktıları frontend container'ın volume'unda yaşıyor
      // (`/app/playwright-report/`, `/app/test-results/`). HMR scope'una
      // alınırsa Tailwind CSS analizi rapor asset'lerini resolve etmeye
      // çalışıp 500 fırlatıyor (playwright-logo.svg ENOENT).
      ignored: ['**/playwright-report/**', '**/test-results/**'],
    },
  },
  // Prod build'de console.* ve debugger çağrılarını strip et (CLAUDE.md §17 #7).
  // Dev'de korunur — error boundary diagnostic'i için.
  esbuild:
    mode === 'production'
      ? { drop: ['console', 'debugger'] }
      : undefined,
}))
