
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// @google/genai: Polyfill __dirname for ESM environments as it is not globally available
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './')
      }
    },
    define: {
      'process.env': JSON.stringify(env) 
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'framer-motion', 'date-fns'],
            genai: ['@google/genai'],
            icons: ['lucide-react']
          }
        }
      }
    }
  }
})
