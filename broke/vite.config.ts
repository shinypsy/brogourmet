import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // dapi 직접 로드가 막힐 때(일부 네트워크·LAN) 브라우저가 같은 origin으로 요청하도록 우회
    proxy: {
      '/kakao-maps-sdk.js': {
        target: 'https://dapi.kakao.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/kakao-maps-sdk\.js/, '/v2/maps/sdk.js'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const host = req.headers.host
            const proto =
              (typeof req.headers['x-forwarded-proto'] === 'string'
                ? req.headers['x-forwarded-proto']
                : null) || 'http'
            const referer = req.headers.referer
            if (referer) {
              proxyReq.setHeader('Referer', referer)
            } else if (host) {
              // Referrer-Policy 등으로 Referer가 없으면 Kakao가 401을 줄 수 있음
              proxyReq.setHeader('Referer', `${proto}://${host}/`)
            }
            const origin = req.headers.origin
            if (origin) {
              proxyReq.setHeader('Origin', origin)
            } else if (host) {
              proxyReq.setHeader('Origin', `${proto}://${host}`)
            }
            const ua = req.headers['user-agent']
            if (ua) proxyReq.setHeader('User-Agent', ua)
          })
        },
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})
