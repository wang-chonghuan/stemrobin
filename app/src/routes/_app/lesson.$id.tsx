import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Layers, Menu } from 'lucide-react'

import { getLessonLabel, getLessonNavForIds } from '~/lib/curriculum'
import { getLessonHtml, getLessonPdf, listAvailableLessonIds } from '~/lib/lessons'
import { getLessonReading } from '~/lib/reading'
import { getLocale } from '~/lib/locale'
import { getCurrentUser } from '~/lib/session'
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
      // The stored skill-rendered 課文 html (same render as the PDF): the 全文速览
      // shows it verbatim, and it is also the fallback view when there is no card
      // tree. One renderer, one source — no separate full-text builder.
      html: await getLessonHtml({ data: params.id }),
      lessonIds: await listAvailableLessonIds(),
      locale: await getLocale(),
      user: await getCurrentUser(),
    }
  },
})

function LessonView() {
  const { id, reading, html, lessonIds, locale, user } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const fulltextRef = useRef<HTMLIFrameElement>(null)
  const [quizOpen, setQuizOpen] = useState(false)
  // Open access (STEMROBIN-68): practice is the login wall. A logged-out learner
  // gets a free-sign-in prompt instead of the quiz (recordAnswer would reject
  // anyway); card read-checks stay open to everyone.
  const [practiceGate, setPracticeGate] = useState(false)
  // Reading mode (STEMROBIN-28): 逐卡精读 (card-by-card, DEFAULT) vs 全文速览
  // (whole lesson at once). Full-text records no read-check and does not advance
  // 课文进度; only the card flow does. Only meaningful when there is a card tree.
  const [mode, setMode] = useState<'cards' | 'fulltext'>('cards')
  // STEMROBIN-33: the 课后题 (practice) entry is always openable — it is NOT gated
  // on reading progress. Reading-complete (课文进度) is still earned only by 精读-ing
  // every card (recordReadCheck events); opening/answering practice never grants it.
  const label = getLessonLabel(id, locale)
  const openPractice = () => (user ? setQuizOpen(true) : setPracticeGate(true))

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
            onClick={openPractice}
            title={t(locale, 'lesson.practice.open')}
          >
            <Layers size={16} /> {t(locale, 'lesson.practice')}
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
        {reading && (
          <div className="sr-read-modes" role="group" aria-label={t(locale, 'read.mode.aria')}>
            <button
              type="button"
              className={'sr-read-mode' + (mode === 'cards' ? ' active' : '')}
              aria-pressed={mode === 'cards'}
              onClick={() => setMode('cards')}
            >
              {t(locale, 'read.mode.cards')}
            </button>
            <button
              type="button"
              className={'sr-read-mode' + (mode === 'fulltext' ? ' active' : '')}
              aria-pressed={mode === 'fulltext'}
              onClick={() => setMode('fulltext')}
            >
              {t(locale, 'read.mode.fulltext')}
            </button>
          </div>
        )}
        {reading ? (
          mode === 'fulltext' ? (
            // 全文速览: the whole lesson at once, rendered from the stored skill html
            // (sr_lessons.html) — identical to the PDF (numbered section labels +
            // styled 课后题). The html's 练习 section is prompt-only (no KEY), so it
            // stays display-only. No CardReader = no recordReadCheck = no 进度.
            html ? (
              <LessonFrame frameRef={fulltextRef} html={html} title={label} />
            ) : (
              <p style={{ padding: 20, color: 'var(--sr-ink-dim)' }}>{t(locale, 'lesson.notReady')}</p>
            )
          ) : (
            <CardReader
              lessonId={id}
              reading={reading}
              label={label}
              locale={locale}
              onOpenPractice={openPractice}
            />
          )
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
      <PracticeGateModal open={practiceGate} locale={locale} onClose={() => setPracticeGate(false)} />
    </main>
  )
}

// Open-access login wall (STEMROBIN-68): shown when a logged-out learner opens
// practice. Emphasizes that signing in is free (no paywall) and only saves progress.
function PracticeGateModal({
  open,
  locale,
  onClose,
}: {
  open: boolean
  locale: Locale
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div
      className="sr-modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={t(locale, 'practice.gate.title')}
      onClick={onClose}
    >
      <div className="sr-modal sr-practice-gate" onClick={(e) => e.stopPropagation()}>
        <span className="sr-practice-gate-free">{t(locale, 'login.free')}</span>
        <h2 className="sr-modal-title">{t(locale, 'practice.gate.title')}</h2>
        <p className="sr-modal-body">{t(locale, 'practice.gate.body')}</p>
        <div className="sr-modal-actions">
          <button type="button" className="sr-btn ghost" onClick={onClose}>
            {t(locale, 'practice.gate.cancel')}
          </button>
          <Link to="/login" className="sr-btn primary">
            {t(locale, 'practice.gate.login')}
          </Link>
        </div>
      </div>
    </div>
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
