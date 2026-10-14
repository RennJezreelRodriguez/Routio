import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  // Must match the GitHub repo name, with leading AND trailing slashes,
  // e.g. https://<user>.github.io/Routio/
  base: '/Routio/',
  plugins: [
    react(),
    VitePWA({
      // We ship our own hand-written public/manifest.json (with light/dark
      // icon variants), so don't let the plugin generate/overwrite one.
      manifest: false,
      injectRegister: 'auto',
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
    }),
  ],
})