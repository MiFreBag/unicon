// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const httpsEnabled = process.env.VITE_HTTPS === '1'

export default defineConfig({
  base: '/unicon/',
  plugins: [react(), ...(httpsEnabled ? [basicSsl()] : [])],
  server: {
    port: 5174,
    host: '0.0.0.0', // Allow LAN/dev access
    strictPort: true,
    https: httpsEnabled,
    proxy: {
      // Proxy API calls during development to the local backend server
      '/unicon/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      // Legacy alias if components use /api
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['xterm', 'xterm-addon-fit']
  },
  preview: {
    port: 4173,
    host: true
  }
})
