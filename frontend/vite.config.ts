import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Local dev: the UI calls /api/... on its own origin (localhost:5173) and Vite forwards it to Spring Boot.
    // Same origin from the browser's point of view, so no CORS setup is needed for local development.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
