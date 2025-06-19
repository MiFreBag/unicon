// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/unicon/',
  plugins: [react()],
 server: {
    port: 5174,
    host: '0.0.0.0', // Wichtig: Erlaubt Zugriff von anderen IPs
    strictPort: true,
    hmr: {
      port: 5174,
      host: 'localhost' // Für HMR verwende localhost
    },
    proxy: {
   '/unicon/api': {
      target: 'http://localhost:3001',
      changeOrigin: true
    },
      '/unicon/ws': {
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
  preview: {
    port: 4173,
    host: true
  }
})
