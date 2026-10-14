import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/haus/' : '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local', 'localhost', '127.0.0.1'],
  },
})
