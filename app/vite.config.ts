import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // app/ lives under an npm workspace; the shared .env stays at the repo root
  // (the content skills + n-easyapp read it there), so load env from the parent.
  envDir: '..',
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '~': '/src',
    },
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    nitro(),
  ],
})
