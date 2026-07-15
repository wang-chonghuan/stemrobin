import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Layers, Lock, Menu } from 'lucide-react'

import { getLessonLabel, getLessonNavForIds } from '~/lib/curriculum'
import { getLessonHtml, getLessonPdf, listLessonIds } from '~/lib/lessons'
import { getLessonReading } from '~/lib/reading'
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
      lessonIds: await listLessonIds(),
    }
  },
})

function LessonView() {
  const { id, reading, html, lessonIds } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [quizOpen, setQuizOpen] = useState(false)
  // 精读 gate: the practice deck unlocks only after every card is read (per visit).
  // Lessons without a card tree (fallback html) leave practice open as before.
  const [allRead, setAllRead] = useState(!reading)
  const label = getLessonLabel(id)

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
        <button className="sr-navtoggle" aria-label="打开目录" type="button" onClick={() => setDrawer(true)}>
          <Menu size={18} />
        </button>
        <Link
          to="/"
          className="sr-btn ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}
        >
          <ArrowLeft size={16} /> 返回
        </Link>
        {/* no title in the top bar — the 課文's own numbered h1 (e.g. 2.6 去括号) carries it */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="sr-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}
            onClick={() => setQuizOpen(true)}
            disabled={!allRead}
            title={allRead ? '进入练习题' : '读完全部卡片后解锁练习'}
          >
            {allRead ? <Layers size={16} /> : <Lock size={16} />} 练习题
          </button>
          <button
            type="button"
            className="sr-icontool"
            onClick={downloadPdf}
            aria-label="下载 PDF"
            title="下载 PDF"
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
            onAllRead={() => setAllRead(true)}
            onOpenPractice={() => setQuizOpen(true)}
          />
        ) : html ? (
          <LessonFrame frameRef={iframeRef} html={html} title={label} />
        ) : (
          <p style={{ padding: 20, color: 'var(--sr-ink-dim)' }}>课程内容尚未生成。</p>
        )}
        <LessonNavFooter id={id} lessonIds={lessonIds} />
      </div>
      <QuizDrawer
        contentId={id}
        open={quizOpen}
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
function LessonNavFooter({ id, lessonIds }: { id: string; lessonIds: string[] }) {
  const { prev, next } = getLessonNavForIds(id, lessonIds)
  if (!prev && !next) return null
  return (
    <nav className="sr-lesson-nav" aria-label="课程导航">
      {prev ? (
        <Link to="/lesson/$id" params={{ id: prev.id }} className="sr-btn ghost">
          <ChevronLeft size={16} /> 上一课 · {getLessonLabel(prev.id)}
        </Link>
      ) : (
        <button type="button" className="sr-btn ghost" disabled>
          <ChevronLeft size={16} /> 上一课
        </button>
      )}
      {next ? (
        <Link to="/lesson/$id" params={{ id: next.id }} className="sr-btn ghost">
          下一课 · {getLessonLabel(next.id)} <ChevronRight size={16} />
        </Link>
      ) : (
        <button type="button" className="sr-btn ghost" disabled>
          下一课 <ChevronRight size={16} />
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
