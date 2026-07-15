import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Layers, Lock, Menu } from 'lucide-react'

import { getLessonLabel, getLessonNavForIds } from '~/lib/curriculum'
import { getLessonHtml, getLessonPdf, listAvailableLessonIds } from '~/lib/lessons'
import { getLessonReading } from '~/lib/reading'
import { getLocale } from '~/lib/locale'
import { t, type Locale } from '~/lib/i18n'
import {
  getLessonQuestions,
  recordAnswer,
  getLatestScore,
  getOpenAttempt,
  startAttempt,
  endAttempt,
} from '~/lib/quiz'
import { useLayoutStore } from '~/lib/layout-store'
import { QuizDrawer } from '~/components/quiz-drawer'
import { CardReader } from '~/components/card-reader'

export const Route = createFileRoute('/_app/lesson/$id')({
  component: LessonView,
  loader: async ({ params }) => {
    const reading = await getLessonReading({ data: params.id })
    return {
      id: params.id,
      reading,
      // Full-lesson html only needed as a fallback when there is no card tree.
      html: reading ? null : await getLessonHtml({ data: params.id }),
      lessonIds: await listAvailableLessonIds(),
      locale: await getLocale(),
    }
  },
})

function LessonView() {
  const { id, reading, html, lessonIds, locale } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [quizOpen, setQuizOpen] = useState(false)
  // 精读 gate: the practice deck unlocks only after every card is read (per visit).
  // Lessons without a card tree (fallback html) leave practice open as before.
  const [allRead, setAllRead] = useState(!reading)
  const label = getLessonLabel(id, locale)

  async function downloadPdf() {
    const b64 = await getLessonPdf({ data: id })
    if (!b64) return
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${label}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="sr-detail">
      <div className="sr-d-top">
        <button className="sr-navtoggle" aria-label={t(locale, 'cat.open')} type="button" onClick={() => setDrawer(true)}>
          <Menu size={18} />
        </button>
        <Link
          to="/"
          className="sr-btn ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}
        >
          <ArrowLeft size={16} /> {t(locale, 'lesson.back')}
        </Link>
        {/* no title in the top bar — the 課文's own numbered h1 (e.g. 2.6 去括号) carries it */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="sr-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}
            onClick={() => setQuizOpen(true)}
            disabled={!allRead}
            title={allRead ? t(locale, 'lesson.practice.open') : t(locale, 'lesson.practice.locked')}
          >
            {allRead ? <Layers size={16} /> : <Lock size={16} />} {t(locale, 'lesson.practice')}
          </button>
          <button
            type="button"
            className="sr-icontool"
            onClick={downloadPdf}
            aria-label={t(locale, 'lesson.pdf')}
            title={t(locale, 'lesson.pdf')}
          >
            <Download size={17} />
          </button>
        </div>
      </div>
      <div className="sr-d-scroll" style={{ padding: 0 }}>
        {reading ? (
          <CardReader
            lessonId={id}
            reading={reading}
            label={label}
            locale={locale}
            onAllRead={() => setAllRead(true)}
            onOpenPractice={() => setQuizOpen(true)}
          />
        ) : html ? (
          <LessonFrame frameRef={iframeRef} html={html} title={label} />
        ) : (
          <p style={{ padding: 20, color: 'var(--sr-ink-dim)' }}>{t(locale, 'lesson.notReady')}</p>
        )}
        <LessonNavFooter id={id} lessonIds={lessonIds} locale={locale} />
      </div>
      <QuizDrawer
        contentId={id}
        open={quizOpen}
        locale={locale}
        onClose={() => setQuizOpen(false)}
        fetchQuestions={getLessonQuestions}
        record={recordAnswer}
        attempts={{
          fetchScore: getLatestScore,
          fetchOpenAttempt: getOpenAttempt,
          startAttempt,
          endAttempt,
        }}
      />
    </main>
  )
}

// Bottom prev/next navigation between lessons that have pages, in CURRICULUM
// order (SR-3). Unknown ids (no page) render no nav; at the first/last page the
// corresponding side is disabled (kept in layout) instead of hidden.
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
