import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { CatalogSidebar } from '~/components/catalog'
import { LocaleMenu } from '~/components/locale-menu'
import { listAvailableLessonIds } from '~/lib/lessons'
import { listEnglishLessons } from '~/lib/english'
import { getLocale } from '~/lib/locale'
import { useLayoutStore } from '~/lib/layout-store'
import { getCurrentUser } from '~/lib/session'
import { t } from '~/lib/i18n'
import { visualViewportVariables } from '~/lib/visual-viewport'

export const Route = createFileRoute('/_app')({
  // Open access (STEMROBIN-68): the learner surfaces (/, /card/$id) are PUBLIC —
  // browsing lessons and answering card read-checks needs no login (read-checks are
  // judged server-side but only persisted for a logged-in user; see recordReadCheck).
  // The login wall lives at the practice deck (recordAnswer requires a user) and at
  // its entry prompt, not here. `user` is still loaded (may be null) so the shell can
  // show either the account menu or a sign-in CTA.
  component: AppShell,
  loader: async () => ({
    lessonIds: await listAvailableLessonIds(),
    englishLessons: await listEnglishLessons(),
    locale: await getLocale(),
    user: await getCurrentUser(),
  }),
})

// Three-column-style app shell (catalog + detail), ported from houserobin's
// responsive layout: fixed catalog on desktop (≥1200px); a slide-in drawer with
// scrim below 1200px. The catalog is persistent — the detail pane swaps via
// <Outlet /> for the overview and lesson routes, so the sidebar is always shown.
function AppShell() {
  const { lessonIds, englishLessons, locale, user } = Route.useLoaderData()
  const drawerOpen = useLayoutStore((s) => s.drawerOpen)
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const [isMobile, setIsMobile] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const shell = shellRef.current
    if (!shell || !isMobile) return
    const viewport = window.visualViewport
    const sync = () => {
      const variables = visualViewportVariables(
        viewport ?? {
          offsetLeft: 0,
          offsetTop: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        },
      )
      for (const [name, value] of Object.entries(variables)) {
        shell.style.setProperty(name, value)
      }
    }
    sync()
    viewport?.addEventListener('resize', sync)
    viewport?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    return () => {
      viewport?.removeEventListener('resize', sync)
      viewport?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      for (const name of Object.keys(visualViewportVariables({
        offsetLeft: 0,
        offsetTop: 0,
        width: 1,
        height: 1,
      }))) {
        shell.style.removeProperty(name)
      }
    }
  }, [isMobile])

  return (
    <div className={`sr-app${isMobile ? ' mobile' : ''}`} ref={shellRef}>
      <button
        aria-label={t(locale, 'cat.close')}
        className={`sr-scrim${drawerOpen ? ' show' : ''}`}
        onClick={() => setDrawer(false)}
        type="button"
      />
      <CatalogSidebar
        lessonIds={lessonIds}
        englishLessons={englishLessons}
        locale={locale}
        user={user}
        drawerOpen={drawerOpen}
        onNavigate={() => isMobile && setDrawer(false)}
      />
      <Outlet />
      {/* Pinned to the top-right of the detail pane. It lives here, not in the
          five routes that each render their own top bar. */}
      <LocaleMenu locale={locale} />
    </div>
  )
}
