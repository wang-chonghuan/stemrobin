import { createStart } from '@tanstack/react-start'

// No Clerk: LemmaDeck has no auth layer this stage. Kept for parity with the
// reference architecture and as the hook for future request middleware.
export const startInstance = createStart(() => ({}))
