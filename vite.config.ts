import { defineConfig } from 'vite'
import react         from '@vitejs/plugin-react'
import tailwindcss   from '@tailwindcss/vite'
import { VitePWA }   from 'vite-plugin-pwa'
import path          from 'path'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',   // update SW silently in background
      includeAssets: ['*.png', '*.svg', '*.ico'],
      // Inline manifest here (overrides public/manifest.json if present).
      // Keep in sync with index.html <link rel="manifest">.
      manifest: {
        name:             'Money Manager',
        short_name:       'Money',
        description:      'Private family finance tracker',
        start_url:        '/',
        display:          'standalone',
        background_color: '#080d1a',
        theme_color:      '#080d1a',
        orientation:      'portrait-primary',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
            skipWaiting: true,     // ← activate SW immediately without waiting
            clientsClaim: true,    // ← take control of all tabs immediately
        // Pre-cache entire app bundle
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          // Supabase REST + Auth: NetworkFirst so data stays fresh;
          // falls back to cache if offline or network is slow.
          {
            urlPattern: ({ url }) => url.hostname.includes('supabase.co'),
            handler: 'NetworkFirst',
            options: {
              cacheName:            'supabase-api',
              networkTimeoutSeconds: 4,
              expiration:           { maxEntries: 100, maxAgeSeconds: 300 },
              cacheableResponse:    { statuses: [0, 200] },
            },
          },
          // Google Fonts: CacheFirst — font files never change
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName:         'google-fonts',
              expiration:        { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})