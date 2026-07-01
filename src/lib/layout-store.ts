import { create } from 'zustand'

// Catalog drawer state — persists across route navigation (the catalog itself
// lives in the _app layout and is never unmounted). Mirrors houserobin's
// drawer/scrim pattern: on desktop (≥1200px) the catalog is always visible and
// this flag is ignored; below 1200px it drives the slide-in drawer + scrim.
type LayoutState = {
  drawerOpen: boolean
  setDrawer: (open: boolean) => void
  toggleDrawer: () => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  drawerOpen: false,
  setDrawer: (drawerOpen) => set({ drawerOpen }),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
}))
