import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const SSOT = fileURLToPath(new URL('../ssot-resources', import.meta.url))

export default defineConfig({
  // app/ lives under an npm workspace; the shared .env stays at the repo root
  // (the content skills + n-easyapp read it there), so load env from the parent.
  envDir: '..',
  // This project's fixed dev port (STEMROBIN-111) — the single source of truth;
  // .claude/launch.json attaches here instead of passing --port.
  server: {
    port: 3200,
    // app/ carries its own lockfile, so Vite takes app/ for the workspace root
    // and would refuse to serve @ssot in dev. It is read-only source data.
    fs: { allow: ['.', SSOT] },
  },
  resolve: {
    alias: {
      '~': '/src',
      // The textbook transcriptions are a repo-level source of truth, not app
      // assets, so they live outside app/ and are imported through this alias.
      // The Dockerfile mirrors the layout (repo root → /, app/ → /app) so the
      // same path resolves inside the image.
      '@ssot': SSOT,
    },
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    nitro(),
  ],
})
