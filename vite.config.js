import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Atualiza sozinho quando uma versao nova e publicada (§3).
      registerType: 'autoUpdate',
      // Pendura nossos handlers de push (public/push-sw.js) no service worker
      // gerado pelo Workbox, sem migrar para injectManifest (#14 Web Push).
      workbox: {
        importScripts: ['push-sw.js'],
      },
      manifest: {
        name: 'Service Desk - EsquadSystem',
        short_name: 'Service Desk',
        description: 'Service Desk de demandas da EsquadSystem',
        lang: 'pt-BR',
        theme_color: '#1f6feb',
        background_color: '#f4f5f7',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      // Permite testar o service worker no servidor de desenvolvimento.
      devOptions: { enabled: true },
    }),
  ],
})
