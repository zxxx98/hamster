import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '家庭库存',
        short_name: '家庭库存',
        display: 'standalone',
        start_url: '/',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
  },
})
