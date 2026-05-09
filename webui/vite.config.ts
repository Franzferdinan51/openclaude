import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy API calls to Dashboard server (3001) which has working endpoints
// The OpenClaw gateway (18789) doesn't expose /api/* routes,
// but the Dashboard Express server does
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})