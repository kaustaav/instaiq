import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Local dev: the UI calls /api/... on its own origin (localhost:5173) and Vite forwards it to Spring Boot.
    // Same origin from the browser's point of view, so no CORS setup is needed for local development.
    // changeOrigin: false keeps Host = localhost:5173, so the backend sees the same site as the browser: browsers send
    // an Origin header on POST/PUT/DELETE, and with a rewritten Host the backend's CORS filter would refuse it (403).
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: false },
    },
  },
})
