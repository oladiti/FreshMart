import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Proxy API calls through the dev server so the browser talks to its own
  // origin (localhost:5173). This keeps auth cookies first-party in dev, exactly
  // like the same-origin production deploy, avoiding cross-origin cookie issues.
  server: {
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
})
