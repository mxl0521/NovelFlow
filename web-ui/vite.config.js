import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  const proxyTarget = process.env.NOVELFLOW_API_PROXY || `http://127.0.0.1:${process.env.NOVELFLOW_API_PORT || 8787}`

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: false,
        },
      },
    },
  }
})
