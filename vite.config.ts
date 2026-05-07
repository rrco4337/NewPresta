import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        [env.VITE_API_BASE_URL]: {
          target: env.VITE_PRESTASHOP_URL,
          changeOrigin: true,
          rewrite: (path) => path,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const apiKey = env.VITE_PRESTASHOP_API_KEY;
              const auth = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
              proxyReq.setHeader('Authorization', auth);
            });
          }
        },
        // Proxy pour les endpoints d'authentification admin PrestaShop (BO)
        [`/${env.VITE_ADMIN_DIR}`]: {
          target: env.VITE_PRESTASHOP_URL,
          changeOrigin: true,
          cookieDomainRewrite: 'localhost',
        }
      }
    }
  }
})