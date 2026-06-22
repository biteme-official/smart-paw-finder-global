import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxy = env.LOCAL_DEV ? 'http://localhost:3000' : 'https://biteme-admin-manage.vercel.app'
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: { '/api': apiProxy },
    },
  }
})
