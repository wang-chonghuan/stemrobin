import { useEffect, useRef, useState } from 'react'

// The document sizes itself: the iframe has no intrinsic height, so measure the
// inner body and grow to it. Re-measured on load, on inner resize, and twice on a
// timer — KaTeX fonts and inline SVG settle after first paint and change height.
export function LessonFrame({
  frameRef,
  html,
  title,
}: {
  /** Passed only where the host needs the element too (the lesson view scrolls
   *  it on navigation). Left off, the frame keeps its own ref. */
  frameRef?: React.RefObject<HTMLIFrameElement | null>
  html: string
  title: string
}) {
  const ownRef = useRef<HTMLIFrameElement>(null)
  const ref = frameRef ?? ownRef
  const [height, setHeight] = useState(600)

  useEffect(() => {
    const iframe = ref.current
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
  }, [ref, html])

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-modals"
      style={{ width: '100%', height, border: 0, display: 'block' }}
    />
  )
}
