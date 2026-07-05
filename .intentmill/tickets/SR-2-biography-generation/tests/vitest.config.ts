import { defineConfig } from 'vitest/config'

// Ticket-scoped vitest config (SR-2). Run from repo root:
//   npx vitest run --config .intentmill/tickets/SR-2-biography-generation/tests/vitest.config.ts
export default defineConfig({
  test: {
    root: process.cwd(),
    include: ['.intentmill/tickets/SR-2-biography-generation/tests/**/*.test.ts'],
    environment: 'node',
  },
})
