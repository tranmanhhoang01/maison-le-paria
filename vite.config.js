import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // '/' khi có domain riêng, '/ten-repo/' khi chạy trên github.io.
  // Workflow tự đặt biến này; xem .github/workflows/deploy.yml
  base: process.env.SITE_BASE ?? '/',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
  },
})
