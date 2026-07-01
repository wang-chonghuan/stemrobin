import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Menu } from 'lucide-react'

import { getLesson } from '~/lib/lessons'
import { useLayoutStore } from '~/lib/layout-store'

export const Route = createFileRoute('/_app/lesson/$id')({
  component: LessonView,
  loader: async ({ params }) => {
    const meta = await getLesson({ data: params.id })
    return { id: params.id, meta }
  },
})

function LessonView() {
  const { id, meta } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const src = `/lessons/${id}.html`

  return (
    <main className="sr-detail">
      <div className="sr-d-top">
        <button
          className="sr-navtoggle"
          aria-label="打开目录"
          type="button"
          onClick={() => setDrawer(true)}
        >
          <Menu size={18} />
        </button>
        <Link
          to="/"
          className="sr-btn ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}
        >
          <ArrowLeft size={16} /> 返回
        </Link>
        <span className="sr-d-title">{meta?.title ?? id}</span>
        {meta?.status === 'draft' && <span className="sr-tag" style={{ marginLeft: 'auto' }}>草稿</span>}
      </div>
      <div className="sr-d-scroll" style={{ padding: 0 }}>
        <LessonFrame src={src} title={meta?.title ?? id} />
      </div>
    </main>
  )
}

function LessonFrame({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(600)

  useEffect(() => {
    const iframe = ref.current
    if (!iframe) return

    let observer: ResizeObserver | null = null
    const timers: ReturnType<typeof setTimeout>[] = []

    const measure = () => {
      // Measure body.scrollHeight, NOT documentElement.scrollHeight: the latter is
      // clamped to max(content, iframe viewport), so once the iframe grows (e.g. a
      // learner opens an answer) it can never shrink back — leaving blank space.
      // body height is content-driven, so it shrinks correctly when answers close.
      const h = iframe.contentDocument?.body?.scrollHeight
      if (h && h > 0) setHeight(h)
    }

    const setup = () => {
      measure()
      // KaTeX renders asynchronously after its deferred scripts run, which reflows
      // the document. Track the body so the iframe grows to the final height.
      const body = iframe.contentDocument?.body
      if (body && 'ResizeObserver' in window) {
        observer?.disconnect()
        observer = new ResizeObserver(measure)
        observer.observe(body)
      }
      timers.push(setTimeout(measure, 300), setTimeout(measure, 1200))
    }

    iframe.addEventListener('load', setup)
    // Guard the race where the iframe (cached/fast) already fired `load` before
    // this effect attached the listener — set up immediately if it's done.
    if (iframe.contentDocument?.readyState === 'complete') setup()

    return () => {
      iframe.removeEventListener('load', setup)
      observer?.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [src])

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      sandbox="allow-scripts allow-same-origin"
      style={{ width: '100%', height, border: 0, display: 'block' }}
    />
  )
}
