# Tech Stack

- Base: tanstack-start (SSR full-stack, single app in `src/`), React 19, TypeScript
- Routing: @tanstack/react-router (file-based, `src/routes/`)
- Styling: Tailwind CSS 4 (+ tw-animate-css), Geist font
- State: zustand (`src/lib/layout-store.ts`)
- Data: PostgreSQL via `postgres` client (`src/lib/db.ts`); session via `src/lib/session.server.ts`
- Content pipeline: markdown via `marked`; curriculum/lessons/stories/quiz in `src/lib/`
- Build/test: vite, vitest (`npm run dev|build|test|start`)
- Deploy: Azure Container Apps `ca-stemrobin` via n-easyapp (Dockerfile at repo root)
