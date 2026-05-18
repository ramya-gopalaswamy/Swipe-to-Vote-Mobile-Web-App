import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Align with Express `server/index.js` (default PORT=4000, overridable via `.env*` or shell env).
const API_PORT = process.env.PORT || '4000'
const apiTarget = `http://127.0.0.1:${API_PORT}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
