import { defineConfig } from 'vitest/config'

// Ticket-scoped vitest config (SR-1). Run from repo root:
//   npx vitest run --config .intentmill/tickets/SR-1-exercise-cap-cardquiz/tests/vitest.config.ts
export default defineConfig({
  test: {
    root: process.cwd(),
    include: ['.intentmill/tickets/SR-1-exercise-cap-cardquiz/tests/**/*.test.ts'],
    environment: 'node',
  },
})
