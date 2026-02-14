import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // build target tuned for modern mobiles + evergreen browsers (see package.json > browserslist)
  esbuild: { target: 'es2017' },
  build: { target: 'es2017' },
  server: {
    port: 5173,
    // Proxy API requests to the locally running backend (useful for dev & Playwright)
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
        ws: false
      }
    }
  }
})
