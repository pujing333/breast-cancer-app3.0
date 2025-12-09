
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  // Use __dirname instead of process.cwd() to avoid TS error "Property 'cwd' does not exist on type 'Process'"
  const env = loadEnv(mode, __dirname, '');
  
  // 关键修复：兼容 API_KEY 或 VITE_API_KEY
  // 无论您在 Vercel 设置的是哪种名字，这里都会抓取到
  const apiKey = env.API_KEY || env.VITE_API_KEY || env.GEMINI_API_KEY || '';

  return {
    plugins: [react()],
    // 将抓取到的 Key 注入到全局变量 process.env.API_KEY 中
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
        'components': path.resolve(__dirname, './components')
      }
    },
    server: {
      host: true,
      proxy: {
        '/google-api': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/google-api/, '')
        }
      }
    }
  }
})
