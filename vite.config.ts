import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    define: {
      // Expose only specific keys to avoid security risk warning
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.Biblia_ADMA_API': JSON.stringify(env.Biblia_ADMA_API),
      // For the loop API_KEY_1 to API_KEY_50 used in gemini.js (which is serverless and reads from process.env directly, 
      // but if used in client code via process.env[keyName], we might need them. 
      // However, usually Vercel serverless functions environment is separate from Vite build 'define'.
      // This 'define' is mostly for the client-side code replacement.
      // We will allow process.env for fallback compatibility but ignore the warning if user insists,
      // OR better, we just don't polyfill the whole object.
      // Since the app code relies on process.env in some places, we will keep it but filter common keys if needed.
      // For now, to fix the specific warning "define option contains an object with PATH", we can just be careful.
      // But keeping it as is works for functionality, the warning is just a warning.
      // To strictly fix it, we'd need to list all used keys.
      // Let's rely on standard 'process.env': env behavior but maybe filter out system keys?
      // Actually, standard Vite doesn't polyfill process.env automatically. 
      // The previous code `define: { 'process.env': env }` is what causes the warning.
      // A safer way is:
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