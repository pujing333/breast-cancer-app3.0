
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const apiKey = env.API_KEY || env.VITE_API_KEY || env.GEMINI_API_KEY || '';

  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
        'components': path.resolve(__dirname, './components')
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild'
    }
  }
})
