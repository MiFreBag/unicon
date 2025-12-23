// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(async () => {
  const httpsEnabled = process.env.VITE_HTTPS === '1'

  const plugins = [react()]
  if (httpsEnabled) {
    try {
      const { default: basicSsl } = await import('@vitejs/plugin-basic-ssl')
      if (basicSsl) plugins.push(basicSsl())
    } catch (_) {
      // optional: plugin not installed; continue without HTTPS plugin
    }
  }

  return {
    base: '/unicon/',
    plugins,
    server: {
      port: 5174,
      host: '0.0.0.0', // Allow LAN/dev access
      strictPort: true,
      https: httpsEnabled,
      proxy: {
        // Proxy API calls during development to the local backend server
        '/unicon/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false
        },
        // Legacy alias if components use /api
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false
        },
        '/ws': {
          // Use HTTP scheme for target; proxy handles WS upgrade when ws:true
          target: 'http://127.0.0.1:8080',
          ws: true,
          changeOrigin: true,
          secure: false
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
  }
})
