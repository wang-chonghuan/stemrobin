// One lesson = one rendered 課文 document.
//
// The previous view was a card reader + quiz drawer + PDF download, all driven by
// a card tree with per-node i18n overlays. Textbook content now arrives as a
// single self-contained HTML document (KaTeX pre-rendered, figures inlined as
// SVG), so this view's whole job is to hand
// that document to an iframe and let the learner read it. Practice will return
// as its own surface later; it is deliberately not modelled here.

import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ChevronLeft, ChevronRight, Menu } from 'lucide-react'

import { getLessonLabel, getLessonNavForIds } from '~/lib/curriculum'
import { getLessonHtml, listAvailableLessonIds } from '~/lib/lessons'
import { getLocale } from '~/lib/locale'
import { t, type Locale } from '~/lib/i18n'
import { useLayoutStore } from '~/lib/layout-store'

export const Route = createFileRoute('/_app/lesson/$id')({
  component: LessonView,
  loader: async ({ params }) => ({
    id: params.id,
    html: await getLessonHtml({ data: params.id }),
    lessonIds: await listAvailableLessonIds(),
    locale: await getLocale(),
  }),
})

function LessonView() {
  const { id, html, lessonIds, locale } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const label = getLessonLabel(id, locale)

  return (
    <main className="sr-detail">
      <div className="sr-d-top">
        <button
          className="sr-navtoggle"
          aria-label={t(locale, 'cat.open')}
          type="button"
          onClick={() => setDrawer(true)}
        >
          <Menu size={18} />
        </button>
        <Link
          to="/learn"
          className="sr-btn ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}
        >
          <ArrowLeft size={16} /> {t(locale, 'lesson.back')}
        </Link>
        <span className="sr-d-title" style={{ marginLeft: 8 }}>
          {label}
        </span>
      </div>
      <div className="sr-d-scroll" style={{ padding: 0 }}>
        {html ? (
          <LessonFrame frameRef={frameRef} html={html} title={label} />
        ) : (
          <p style={{ padding: 20, color: 'var(--sr-ink-dim)' }}>
            {t(locale, 'lesson.notReady')}
          </p>
        )}
        <LessonNavFooter id={id} lessonIds={lessonIds} locale={locale} />
      </div>
    </main>
  )
}

function LessonNavFooter({
  id,
  lessonIds,
  locale,
}: {
  id: string
  lessonIds: string[]
  locale: Locale
}) {
  const { prev, next } = getLessonNavForIds(id, lessonIds, locale)
  if (!prev && !next) return null
  return (
    <nav className="sr-lesson-nav" aria-label={t(locale, 'lesson.nav')}>
      {prev ? (
        <Link to="/lesson/$id" params={{ id: prev.id }} className="sr-btn ghost">
          <ChevronLeft size={16} /> {t(locale, 'lesson.prev')} · {getLessonLabel(prev.id, locale)}
        </Link>
      ) : (
        <button type="button" className="sr-btn ghost" disabled>
          <ChevronLeft size={16} /> {t(locale, 'lesson.prev')}
        </button>
      )}
      {next ? (
        <Link to="/lesson/$id" params={{ id: next.id }} className="sr-btn ghost">
          {t(locale, 'lesson.next')} · {getLessonLabel(next.id, locale)} <ChevronRight size={16} />
        </Link>
      ) : (
        <button type="button" className="sr-btn ghost" disabled>
          {t(locale, 'lesson.next')} <ChevronRight size={16} />
        </button>
      )}
    </nav>
  )
}

// The document sizes itself: the iframe has no intrinsic height, so measure the
// inner body and grow to it. Re-measured on load, on inner resize, and twice on a
// timer — KaTeX fonts and inline SVG settle after first paint and change height.
function LessonFrame({
  frameRef,
  html,
  title,
}: {
  frameRef: React.RefObject<HTMLIFrameElement | null>
  html: string
  title: string
}) {
  const [height, setHeight] = useState(600)

  useEffect(() => {
    const iframe = frameRef.current
    if (!iframe) return

    let observer: ResizeObserver | null = null
    const timers: ReturnType<typeof setTimeout>[] = []

    const measure = () => {
      const h = iframe.contentDocument?.body?.scrollHeight
      if (h && h > 0) setHeight(h)
    }

    const setup = () => {
      measure()
      const body = iframe.contentDocument?.body
      if (body && 'ResizeObserver' in window) {
        observer?.disconnect()
        observer = new ResizeObserver(measure)
        observer.observe(body)
      }
      timers.push(setTimeout(measure, 300), setTimeout(measure, 1200))
    }

    iframe.addEventListener('load', setup)
    if (iframe.contentDocument?.readyState === 'complete') setup()

    return () => {
      iframe.removeEventListener('load', setup)
      observer?.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [frameRef, html])

  return (
    <iframe
      ref={frameRef}
      srcDoc={html}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-modals"
      style={{ width: '100%', height, border: 0, display: 'block' }}
    />
  )
}
