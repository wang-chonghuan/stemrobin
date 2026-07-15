import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Layers, RotateCcw, X } from 'lucide-react'

import { getCurrentUser } from '~/lib/session'
import { recordReadCheck } from '~/lib/reading'
import type { LessonReading, ReadCheck, ReadingCard } from '~/lib/reading'

// Card-by-card 精读 flow. One numbered card at a time: read the card body (its own
// sandboxed iframe, reusing the lesson's <head> so formulas + lesson styles render),
// then answer that card's read-check. Correct → the card is "passed" and 下一张 opens.
// Wrong → guide back to re-read THIS card and retry (soft gate: no penalty, no lock,
// already-passed cards stay reviewable). All cards passed → 读完/可进入练习.
//
// Read-check correctness is judged server-side (recordReadCheck); the KEY never
// reaches the browser. Recording happens only when logged in (未登录不记录作答).

type Reading = NonNullable<LessonReading>

// Render KaTeX ($…$ / $$…$$) inside an app-DOM node using the root document's
// auto-render (read-check prompts/options live in the app DOM, not the iframe).
function renderMath(el: HTMLElement | null) {
  const fn = (window as unknown as { renderMathInElement?: Function }).renderMathInElement
  if (el && typeof fn === 'function') {
    fn(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
    })
  }
}

// Full self-contained srcDoc for one card: lesson head (KaTeX + tokens + styles) +
// the card body wrapped in the lesson's own container so element classes apply.
function cardSrcDoc(head: string, bodyHtml: string): string {
  return `<!doctype html><html lang="zh-CN"><head>${head}</head><body><article class="sr-lesson">${bodyHtml}</article></body></html>`
}

// One card body in a sandboxed iframe. Height is measured from the content and
// re-measured on srcDoc swap + after KaTeX/CDN reflow (same lifecycle as the
// full-lesson LessonFrame).
function CardFrame({ head, bodyHtml, title }: { head: string; bodyHtml: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(320)
  const srcDoc = cardSrcDoc(head, bodyHtml)

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
  }, [srcDoc])

  return (
    <iframe
      ref={frameRef}
      srcDoc={srcDoc}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-modals"
      style={{ width: '100%', height, border: 0, display: 'block' }}
    />
  )
}

// Per-read-check local result. `correct` locks the item; a wrong result keeps it
// answerable (retry) and remembers the wrong pick/text for display.
type CheckResult = { correct: boolean; chosen?: number; text?: string }

function cardPassed(card: ReadingCard, results: Record<string, CheckResult>): boolean {
  return card.readChecks.every((rc) => results[rc.id]?.correct)
}

export function CardReader({
  lessonId,
  reading,
  label,
  onAllRead,
  onOpenPractice,
}: {
  lessonId: string
  reading: Reading
  label: string
  onAllRead: () => void
  onOpenPractice: () => void
}) {
  const { head, cards } = reading
  const [current, setCurrent] = useState(0)
  const [results, setResults] = useState<Record<string, CheckResult>>({})
  const [typed, setTyped] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null) // read-check id in flight
  const [err, setErr] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const checksRef = useRef<HTMLDivElement>(null)

  const card = cards[current]
  const total = cards.length
  const passed = cardPassed(card, results)
  const allRead = cards.every((c) => cardPassed(c, results))
  const isLast = current === total - 1
  // Completion UI shows only once the learner has reached the last card and every
  // card is passed — so a trailing card with no read-check (e.g. oral) is still
  // walked through rather than skipped the moment the previous card passes.
  const showDone = allRead && isLast

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const user = await getCurrentUser()
      if (!cancelled) setLoggedIn(!!user)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Typeset read-check prompts/options when the visible card changes.
  useEffect(() => {
    const t = setTimeout(() => renderMath(checksRef.current), 0)
    return () => clearTimeout(t)
  }, [current, results])

  // Fire the completion callback once all cards are passed.
  useEffect(() => {
    if (allRead) onAllRead()
  }, [allRead, onAllRead])

  async function submit(rc: ReadCheck, submission: { chosen?: number; text?: string }) {
    if (busy) return
    setErr(null)
    setBusy(rc.id)
    try {
      const r = await recordReadCheck({
        data: { lessonId, nodeId: rc.id, ...submission },
      })
      if ('error' in r) {
        setErr(r.error)
        return
      }
      setResults((m) => ({ ...m, [rc.id]: { correct: r.isCorrect, ...submission } }))
    } catch {
      setErr('网络不太顺，请再试一次。')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="sr-card-reader">
      <div className="sr-card-head">
        <div className="sr-card-lesson">{label}</div>
        <div className="sr-card-progress">
          第 <b>{card.num}</b> / {total} 张卡片
        </div>
      </div>

      <div className="sr-card-frame-wrap">
        <CardFrame head={head} bodyHtml={card.bodyHtml} title={`${label} · 第 ${card.num} 张`} />
      </div>

      <div className="sr-card-checks" ref={checksRef}>
        {card.readChecks.length === 0 ? (
          <p className="sr-card-noread">这张卡片没有读一读，直接看下一张。</p>
        ) : (
          <>
            <div className="sr-card-checks-title">读一读 · 读完这张卡再作答</div>
            {card.readChecks.map((rc, i) => (
              <ReadCheckItem
                key={rc.id}
                rc={rc}
                index={i}
                result={results[rc.id]}
                typedVal={typed[rc.id] ?? ''}
                busy={busy === rc.id}
                onType={(v) => setTyped((m) => ({ ...m, [rc.id]: v }))}
                onChoose={(chosen) => submit(rc, { chosen })}
                onSubmitText={(text) => submit(rc, { text })}
              />
            ))}
          </>
        )}
        {err && <div className="sr-quiz-err">{err}</div>}
        {loggedIn === false && (
          <p className="sr-card-guest">未登录也能读；登录后你的作答才会被记录。</p>
        )}
      </div>

      {showDone ? (
        <div className="sr-card-done">
          <div className="sr-card-done-badge">
            <Check size={18} /> 这一课读完了
          </div>
          <p>全部 {total} 张卡片都读过并作答通过，可以开始练习了。</p>
          <button type="button" className="sr-btn" onClick={onOpenPractice}>
            <Layers size={16} /> 进入练习
          </button>
        </div>
      ) : (
        <nav className="sr-card-nav" aria-label="卡片导航">
          <button
            type="button"
            className="sr-btn ghost"
            disabled={current === 0}
            onClick={() => {
              setErr(null)
              setCurrent((i) => Math.max(0, i - 1))
            }}
          >
            <ChevronLeft size={16} /> 上一张卡片
          </button>
          {passed ? (
            <button
              type="button"
              className="sr-btn"
              disabled={isLast}
              onClick={() => {
                setErr(null)
                setCurrent((i) => Math.min(total - 1, i + 1))
              }}
            >
              下一张卡片 <ChevronRight size={16} />
            </button>
          ) : (
            <span className="sr-card-locked">答对本卡的读一读后解锁下一张</span>
          )}
        </nav>
      )}
    </div>
  )
}

function ReadCheckItem({
  rc,
  index,
  result,
  typedVal,
  busy,
  onType,
  onChoose,
  onSubmitText,
}: {
  rc: ReadCheck
  index: number
  result: CheckResult | undefined
  typedVal: string
  busy: boolean
  onType: (v: string) => void
  onChoose: (chosen: number) => void
  onSubmitText: (text: string) => void
}) {
  const correct = result?.correct === true
  const wrong = result != null && !result.correct
  return (
    <div className={'sr-card-check' + (correct ? ' ok' : '')}>
      <div className="sr-card-check-prompt">
        <span className="sr-card-check-n">{index + 1}</span>
        <span dangerouslySetInnerHTML={{ __html: rc.prompt }} />
      </div>

      {rc.mode === 'choice' ? (
        <ul className="sr-quiz-options">
          {(rc.options ?? []).map((opt, o) => {
            const isCorrectPick = correct && result?.chosen === o
            const isWrongPick = wrong && result?.chosen === o
            return (
              <li key={o}>
                <button
                  type="button"
                  className={
                    'sr-quiz-opt' +
                    (isCorrectPick ? ' correct' : '') +
                    (isWrongPick ? ' wrong' : '')
                  }
                  disabled={correct || busy}
                  onClick={() => onChoose(o)}
                >
                  <span
                    className="sr-quiz-opt-text"
                    dangerouslySetInnerHTML={{ __html: opt }}
                  />
                  {isCorrectPick && <Check size={16} />}
                  {isWrongPick && <X size={16} />}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="sr-quiz-input">
          <input
            type="text"
            value={correct ? (result?.text ?? '') : typedVal}
            placeholder="把答案打在这里"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={correct || busy}
            className={'sr-quiz-input-field' + (correct ? ' correct' : wrong ? ' wrong' : '')}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && typedVal.trim()) onSubmitText(typedVal)
            }}
          />
          {!correct && (
            <button
              type="button"
              className="sr-btn"
              disabled={busy || !typedVal.trim()}
              onClick={() => onSubmitText(typedVal)}
            >
              {busy ? '…' : '提交'}
            </button>
          )}
        </div>
      )}

      {correct && (
        <div className="sr-card-check-verdict ok">
          <Check size={15} /> 答对了
        </div>
      )}
      {wrong && (
        <div className="sr-card-check-verdict bad">
          <RotateCcw size={15} /> 答得不对——回到本卡再读一遍，然后重答。
        </div>
      )}
    </div>
  )
}
