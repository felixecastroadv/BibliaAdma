
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(), '');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    define: {
      // Expondo chaves de forma segura para o front-end
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.Biblia_ADMA_API': JSON.stringify(env.Biblia_ADMA_API),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY),
      // Mantemos o fallback para compatibilidade mas sem vazar o PATH do sistema
      'process.env': JSON.stringify({
          NODE_ENV: mode,
          ...Object.fromEntries(
            Object.entries(env).filter(([key]) => 
              key.startsWith('API_KEY') || 
              key.startsWith('SUPABASE') || 
              key.startsWith('NEXT_PUBLIC') ||
              key === 'Biblia_ADMA_API'
            )
          )
      })
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
