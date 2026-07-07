import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Camera, Check, X } from 'lucide-react'

import { getCurrentUser } from '~/lib/session'
import type { QuizQuestion, AnswerResult } from '~/lib/quiz'

// Injected data source so the same drawer serves both lessons (getLessonQuestions
// / recordAnswer over sr_questions / sr_answer_events) and 名人传记 chapters
// (getStoryQuestions / recordStoryAnswer over sr_story_questions /
// sr_story_answer_events). Both fetch WITHOUT the correct option; correctness is
// computed server-side by the record fn.
type FetchQuestions = (opts: { data: string }) => Promise<QuizQuestion[]>
type RecordAnswer = (opts: {
  data: { questionId: number; chosen?: number; text?: string }
}) => Promise<AnswerResult | { error: string }>

// Render KaTeX ($…$ / $$…$$) inside a node, using the CDN auto-render loaded in
// the root document. No-ops until the script is ready.
function renderMath(el: HTMLElement | null) {
  const fn = (window as unknown as { renderMathInElement?: Function })
    .renderMathInElement
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

// Local result also remembers what the learner did (picked option or typed text).
type Verdict = (AnswerResult & { chosen?: number; typed?: string }) | null

export function QuizDrawer({
  contentId,
  open,
  onClose,
  fetchQuestions,
  record,
}: {
  contentId: string
  open: boolean
  onClose: () => void
  fetchQuestions: FetchQuestions
  record: RecordAnswer
}) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<Record<number, Verdict>>({})
  const [picking, setPicking] = useState<number | null>(null) // optimistic click
  const [typedVal, setTypedVal] = useState('') // input-mode draft answer
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const qRef = useRef<HTMLDivElement>(null) // prompt + options (typeset once/card)
  const answerRef = useRef<HTMLDivElement>(null) // revealed answer (typeset on result)
  // Display order per question: a random permutation of the ORIGINAL option indices,
  // so the correct answer isn't always in the same slot. The DB's correct_index is
  // untouched — we only shuffle presentation and map the pick back to the original
  // index. Stable within one showing (kept in a ref); reshuffled on reopen.
  const ordersRef = useRef<Record<number, number[]>>({})

  function displayOrder(qq: QuizQuestion): number[] {
    if (!ordersRef.current[qq.id]) {
      const n = qq.options?.length ?? 0
      const perm = Array.from({ length: n }, (_, k) => k)
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[perm[i], perm[j]] = [perm[j], perm[i]]
      }
      ordersRef.current[qq.id] = perm
    }
    return ordersRef.current[qq.id]
  }

  useEffect(() => {
    if (!open) return
    setIdx(0)
    setResults({})
    setPicking(null)
    setTypedVal('')
    setSubmitting(false)
    setErr(null)
    ordersRef.current = {} // reshuffle option order each time the quiz is opened
    getCurrentUser().then((u) => setLoggedIn(!!u))
    fetchQuestions({ data: contentId }).then(setQuestions)
  }, [open, contentId, fetchQuestions])

  const q = questions[idx]
  const result = q ? results[q.id] ?? null : null

  // Typeset the question + options ONCE when the visible card changes — NOT when
  // the answer arrives (re-typesetting the options reflowed the list and jumped
  // the scroll to the top).
  useEffect(() => {
    const t = setTimeout(() => renderMath(qRef.current), 0)
    return () => clearTimeout(t)
  }, [idx, questions, open, loggedIn])

  // Typeset only the revealed answer, separately, when it appears.
  useEffect(() => {
    if (result) {
      const t = setTimeout(() => renderMath(answerRef.current), 0)
      return () => clearTimeout(t)
    }
  }, [result])

  if (!open) return null

  async function choose(optIndex: number) {
    if (!q || picking != null || results[q.id]) return
    setErr(null)
    setPicking(optIndex) // highlight the click immediately
    try {
      const r = await record({
        data: { questionId: q.id, chosen: optIndex },
      })
      if ('error' in r) {
        if (r.error.includes('登录')) setLoggedIn(false)
        else setErr(r.error)
      } else {
        setResults((m) => ({ ...m, [q.id]: { ...r, chosen: optIndex } }))
      }
    } catch {
      // Network / cold-start / transient backend error — surface it so the tap
      // isn't a silent no-op; the option stays clickable to retry.
      setErr('网络不太顺，请再点一次这个选项重试。')
    } finally {
      setPicking(null)
    }
  }

  async function submitTyped() {
    if (!q || submitting || results[q.id] || !typedVal.trim()) return
    setErr(null)
    setSubmitting(true)
    try {
      const r = await record({ data: { questionId: q.id, text: typedVal } })
      if ('error' in r) {
        if (r.error.includes('登录')) setLoggedIn(false)
        else setErr(r.error)
      } else {
        setResults((m) => ({ ...m, [q.id]: { ...r, typed: typedVal.trim() } }))
        setTypedVal('')
      }
    } catch {
      setErr('网络不太顺，请再点一次「提交」重试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sr-quiz-scrim" onClick={onClose}>
      <section
        className="sr-quiz-drawer"
        role="dialog"
        aria-label="卡片答题"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sr-quiz-head">
          <span className="sr-quiz-title">卡片答题</span>
          {questions.length > 0 && (
            <span className="sr-quiz-count">
              {idx + 1} / {questions.length}
            </span>
          )}
          <button
            type="button"
            className="sr-quiz-close"
            aria-label="关闭"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="sr-quiz-body">
          {loggedIn === false ? (
            <div className="sr-quiz-login">
              <p>答题需要先登录，用于保存你的作答记录。</p>
              <Link to="/login" className="sr-btn" onClick={onClose}>
                去登录
              </Link>
            </div>
          ) : !q ? (
            <p className="sr-quiz-empty">这一课还没有练习题。</p>
          ) : (
            <div className="sr-quiz-card">
              {/* verdict pinned above the card so it's seen immediately (graded modes only) */}
              {result && result.isCorrect !== null && (
                <div
                  className={
                    'sr-quiz-verdict' + (result.isCorrect ? ' ok' : ' bad')
                  }
                >
                  {result.isCorrect ? (
                    <>
                      <Check size={16} /> 答对了
                    </>
                  ) : (
                    <>
                      <X size={16} />{' '}
                      {q.answerMode === 'choice'
                        ? '答错了 · 正确答案已标出'
                        : '答错了 · 看看下面的讲解'}
                    </>
                  )}
                </div>
              )}

              <div ref={qRef}>
                <div className="sr-quiz-ptype">{q.type}</div>
                <div className="sr-quiz-prompt">{q.prompt}</div>

                {q.answerMode === 'work' ? (
                  <div className="sr-quiz-work">
                    <Camera size={26} />
                    <span>这题要讲道理：先把你的解释说出来（说给别人听最好），说完再看参考答案对照。</span>
                    {!result && (
                      <button
                        type="button"
                        className="sr-btn"
                        disabled={submitting}
                        onClick={async () => {
                          if (!q || submitting || results[q.id]) return
                          setErr(null)
                          setSubmitting(true)
                          try {
                            const r = await record({ data: { questionId: q.id } })
                            if ('error' in r) {
                              if (r.error.includes('登录')) setLoggedIn(false)
                              else setErr(r.error)
                            } else {
                              setResults((m) => ({ ...m, [q.id]: { ...r } }))
                            }
                          } catch {
                            setErr('网络不太顺，请再点一次重试。')
                          } finally {
                            setSubmitting(false)
                          }
                        }}
                      >
                        我说完了，看参考答案
                      </button>
                    )}
                  </div>
                ) : q.answerMode === 'input' ? (
                  <div className="sr-quiz-input">
                    <input
                      type="text"
                      value={result ? (result.typed ?? '') : typedVal}
                      placeholder="把答案打在这里，如 3x^2-5"
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={!!result || submitting}
                      className={
                        'sr-quiz-input-field' +
                        (result ? (result.isCorrect ? ' correct' : ' wrong') : '')
                      }
                      onChange={(e) => setTypedVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitTyped()
                      }}
                    />
                    <button
                      type="button"
                      className="sr-btn"
                      disabled={!!result || submitting || !typedVal.trim()}
                      onClick={submitTyped}
                    >
                      {submitting ? '提交中…' : '提交'}
                    </button>
                  </div>
                ) : (
                  <ul className="sr-quiz-options">
                    {displayOrder(q).map((o) => {
                      // o = original option index; rendered in shuffled display order.
                      const opt = q.options![o]
                      const answered = !!result
                      const isCorrect = answered && o === result!.correctIndex
                      const isWrongPick =
                        answered && o === result!.chosen && !result!.isCorrect
                      const isPicking = picking === o && !answered
                      return (
                        <li key={o}>
                          <button
                            type="button"
                            className={
                              'sr-quiz-opt' +
                              (isCorrect ? ' correct' : '') +
                              (isWrongPick ? ' wrong' : '') +
                              (isPicking ? ' picking' : '') +
                              (answered && !isCorrect && !isWrongPick ? ' dim' : '')
                            }
                            disabled={answered || picking != null}
                            onClick={() => choose(o)}
                          >
                            <span className="sr-quiz-opt-text">{opt}</span>
                            {isCorrect && <Check size={16} />}
                            {isWrongPick && <X size={16} />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {err && <div className="sr-quiz-err">{err}</div>}

              {result && (
                <div className="sr-quiz-feedback">
                  <div className="sr-quiz-answer" ref={answerRef}>
                    {result.answer}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {q && loggedIn !== false && (
          <footer className="sr-quiz-foot">
            <button
              type="button"
              className="sr-btn ghost"
              disabled={idx === 0}
              onClick={() => {
                setErr(null)
                setTypedVal('')
                setIdx((i) => Math.max(0, i - 1))
              }}
            >
              上一题
            </button>
            <button
              type="button"
              className="sr-btn"
              disabled={idx >= questions.length - 1}
              onClick={() => {
                setErr(null)
                setTypedVal('')
                setIdx((i) => Math.min(questions.length - 1, i + 1))
              }}
            >
              下一题
            </button>
          </footer>
        )}
      </section>
    </div>
  )
}
