import { useEffect, useState } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { CatalogSidebar } from '~/components/catalog'
import { listAvailableLessonIds } from '~/lib/lessons'
import { getLocale } from '~/lib/locale'
import { useLayoutStore } from '~/lib/layout-store'
import { getStoryCatalog } from '~/lib/stories'
import { t } from '~/lib/i18n'

export const Route = createFileRoute('/_app')({
  component: AppShell,
  loader: async () => ({
    lessonIds: await listAvailableLessonIds(),
    stories: await getStoryCatalog(),
    locale: await getLocale(),
  }),
})

// Three-column-style app shell (catalog + detail), ported from houserobin's
// responsive layout: fixed catalog on desktop (≥1200px); a slide-in drawer with
// scrim below 1200px. The catalog is persistent — the detail pane swaps via
// <Outlet /> for the overview and lesson routes, so the sidebar is always shown.
function AppShell() {
  const { lessonIds, stories, locale } = Route.useLoaderData()
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
        stories={stories}
        lessonIds={lessonIds}
        locale={locale}
        drawerOpen={drawerOpen}
        onNavigate={() => isMobile && setDrawer(false)}
      />
      <Outlet />
    </div>
  )
}
