import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // app/ lives under an npm workspace; the shared .env stays at the repo root
  // (the content skills + n-easyapp read it there), so load env from the parent.
  envDir: '..',
  // This project's fixed dev port (STEMROBIN-111) — the single source of truth;
  // .claude/launch.json attaches here instead of passing --port.
  server: {
    port: 3200,
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
