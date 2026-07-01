import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Download, Menu } from 'lucide-react'

import { getLessonLabel } from '~/lib/curriculum'
import { useLayoutStore } from '~/lib/layout-store'

export const Route = createFileRoute('/_app/lesson/$id')({
  component: LessonView,
  loader: async ({ params }) => ({ id: params.id }),
})

function LessonView() {
  const { id } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const label = getLessonLabel(id)
  const src = `/lessons/${id}.html`

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
        <span className="sr-d-title">{label}</span>
        <div style={{ marginLeft: 'auto' }}>
          <a
            className="sr-icontool"
            href={`/lessons/${id}.pdf`}
            download={`${label}.pdf`}
            aria-label="下载 PDF"
            title="下载 PDF"
          >
            <Download size={17} />
          </a>
        </div>
      </div>
      <div className="sr-d-scroll" style={{ padding: 0 }}>
        <LessonFrame frameRef={iframeRef} src={src} title={label} />
      </div>
    </main>
  )
}

function LessonFrame({
  frameRef,
  src,
  title,
}: {
  frameRef: React.RefObject<HTMLIFrameElement | null>
  src: string
  title: string
}) {
  const [height, setHeight] = useState(600)

  useEffect(() => {
    const iframe = frameRef.current
    if (!iframe) return

    let observer: ResizeObserver | null = null
    const timers: ReturnType<typeof setTimeout>[] = []

    const measure = () => {
      // body.scrollHeight (content-driven), NOT documentElement.scrollHeight
      // (clamped to the iframe viewport, so it could never shrink back).
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
  }, [frameRef, src])

  return (
    <iframe
      ref={frameRef}
      src={src}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-modals"
      style={{ width: '100%', height, border: 0, display: 'block' }}
    />
  )
}
