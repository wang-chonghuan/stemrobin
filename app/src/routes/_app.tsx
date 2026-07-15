import { useEffect, useState } from 'react'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { CatalogSidebar } from '~/components/catalog'
import { listAvailableLessonIds } from '~/lib/lessons'
import { getLocale } from '~/lib/locale'
import { useLayoutStore } from '~/lib/layout-store'
import { getCurrentUser } from '~/lib/session'
import { t } from '~/lib/i18n'

export const Route = createFileRoute('/_app')({
  // Single site-wide auth gate (SSOT). `_app` is the pathless parent of every learner
  // surface (/, /lesson/$id, /login), so one check here gates the whole app.
  // Runs before the loader, so a logged-out user never triggers the protected reads.
  // The login route stays reachable while logged out; everything else redirects to it.
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/login') return
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
  },
  component: AppShell,
  loader: async () => ({
    lessonIds: await listAvailableLessonIds(),
    locale: await getLocale(),
  }),
})

// Three-column-style app shell (catalog + detail), ported from houserobin's
// responsive layout: fixed catalog on desktop (≥1200px); a slide-in drawer with
// scrim below 1200px. The catalog is persistent — the detail pane swaps via
// <Outlet /> for the overview and lesson routes, so the sidebar is always shown.
function AppShell() {
  const { lessonIds, locale } = Route.useLoaderData()
  const drawerOpen = useLayoutStore((s) => s.drawerOpen)
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1199px)')
    const update = () => {
      setIsMobile(media.matches)
      if (!media.matches) setDrawer(false) // desktop: catalog always visible
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [setDrawer])

  return (
    <div className={`sr-app${isMobile ? ' mobile' : ''}`}>
      <button
        aria-label={t(locale, 'cat.close')}
        className={`sr-scrim${drawerOpen ? ' show' : ''}`}
        onClick={() => setDrawer(false)}
        type="button"
      />
      <CatalogSidebar
        lessonIds={lessonIds}
        locale={locale}
        drawerOpen={drawerOpen}
        onNavigate={() => isMobile && setDrawer(false)}
      />
      <Outlet />
    </div>
  )
}
