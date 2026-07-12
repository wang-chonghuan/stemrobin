import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Camera, Check, Flag, Play, RotateCcw, X } from 'lucide-react'

import { getCurrentUser } from '~/lib/session'
import type {
  QuizQuestion,
  AnswerResult,
  ScoreSummary,
  OpenAttempt,
} from '~/lib/quiz'

// Injected data source so the same drawer serves both lessons (getLessonQuestions
// / recordAnswer over sr_questions / sr_answer_events) and 名人传记 chapters
// (getStoryQuestions / recordStoryAnswer over sr_story_questions /
// sr_story_answer_events). Both fetch WITHOUT the correct option; correctness is
// computed server-side by the record fn.
type FetchQuestions = (opts: { data: string }) => Promise<QuizQuestion[]>
type RecordAnswer = (opts: {
  data: { questionId: number; attemptId?: number; chosen?: number; text?: string }
}) => Promise<AnswerResult | { error: string }>

// Optional 答题记录 API. When provided (lessons), the drawer runs the
// start → quiz → result flow with scoring, 继续/重新开始, and 结束本课答题.
// When absent (story chapters), the drawer behaves as a plain answer-through deck.
export type AttemptApi = {
  fetchScore: (opts: { data: string }) => Promise<ScoreSummary | null>
  fetchOpenAttempt: (opts: { data: string }) => Promise<OpenAttempt | null>
  startAttempt: (opts: { data: string }) => Promise<{ attemptId: number } | { error: string }>
  endAttempt: (opts: {
    data: { attemptId: number; lessonId: string }
  }) => Promise<ScoreSummary | { error: string }>
}

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

type Phase = 'start' | 'quiz' | 'result'

export function QuizDrawer({
  contentId,
  open,
  onClose,
  fetchQuestions,
  record,
  attempts,
}: {
  contentId: string
  open: boolean
  onClose: () => void
  fetchQuestions: FetchQuestions
  record: RecordAnswer
  attempts?: AttemptApi
}) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>('quiz')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<Record<number, Verdict>>({})
  const [picking, setPicking] = useState<number | null>(null) // optimistic click
  const [typedVal, setTypedVal] = useState('') // input-mode draft answer
  const [submitting, setSubmitting] = useState(false)
  const [busy, setBusy] = useState(false) // start/end/restart in flight
  const [err, setErr] = useState<string | null>(null)
  const [attemptId, setAttemptId] = useState<number | null>(null)
  const [score, setScore] = useState<ScoreSummary | null>(null) // latest ended / just-ended
  const [openAttempt, setOpenAttempt] = useState<OpenAttempt | null>(null)
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

  // Rebuild the local results map from a resumed attempt's answered items.
  function hydrateResults(answered: OpenAttempt['answered']): Record<number, Verdict> {
    const map: Record<number, Verdict> = {}
    for (const a of answered) {
      map[a.questionId] = {
        isCorrect: a.isCorrect,
        correctIndex: a.correctIndex,
        answer: a.answer,
        chosen: a.chosen ?? undefined,
        typed: a.typed ?? undefined,
      }
    }
    return map
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setIdx(0)
    setResults({})
    setPicking(null)
    setTypedVal('')
    setSubmitting(false)
    setBusy(false)
    setErr(null)
    setAttemptId(null)
    setScore(null)
    setOpenAttempt(null)
    setLoading(true)
    ordersRef.current = {} // reshuffle option order each time the quiz is opened

    ;(async () => {
      const user = await getCurrentUser()
      if (cancelled) return
      const isIn = !!user
      setLoggedIn(isIn)
      const qs = await fetchQuestions({ data: contentId })
      if (cancelled) return
      setQuestions(qs)

      // Story quizzes (no attempt API) or a logged-out learner: plain quiz phase.
      if (!attempts || !isIn) {
        setPhase('quiz')
        setLoading(false)
        return
      }

      const [sc, oa] = await Promise.all([
        attempts.fetchScore({ data: contentId }),
        attempts.fetchOpenAttempt({ data: contentId }),
      ])
      if (cancelled) return
      setScore(sc)
      setOpenAttempt(oa)

      if (sc || oa) {
        setPhase('start') // show the last score and/or a resumable attempt
        setLoading(false)
      } else {
        // No history at all → start a fresh attempt straight into the quiz.
        const r = await attempts.startAttempt({ data: contentId })
        if (cancelled) return
        if ('error' in r) {
          if (r.error.includes('登录')) setLoggedIn(false)
          else setErr(r.error)
        } else {
          setAttemptId(r.attemptId)
          setPhase('quiz')
        }
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, contentId, fetchQuestions, attempts])

  const q = phase === 'quiz' ? questions[idx] : undefined
  const result = q ? results[q.id] ?? null : null

  // Typeset the question + options ONCE when the visible card changes — NOT when
  // the answer arrives (re-typesetting the options reflowed the list and jumped
  // the scroll to the top).
  useEffect(() => {
    const t = setTimeout(() => renderMath(qRef.current), 0)
    return () => clearTimeout(t)
  }, [idx, questions, open, loggedIn, phase])

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
        data: { questionId: q.id, attemptId: attemptId ?? undefined, chosen: optIndex },
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
      const r = await record({
        data: { questionId: q.id, attemptId: attemptId ?? undefined, text: typedVal },
      })
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

  // ── 答题记录 actions (lessons only) ────────────────────────────────────────
  function beginContinue() {
    if (!openAttempt) return
    setErr(null)
    setAttemptId(openAttempt.attemptId)
    setResults(hydrateResults(openAttempt.answered))
    const answeredIds = new Set(openAttempt.answered.map((a) => a.questionId))
    const firstUnanswered = questions.findIndex((qq) => !answeredIds.has(qq.id))
    setIdx(firstUnanswered === -1 ? Math.max(0, questions.length - 1) : firstUnanswered)
    setPhase('quiz')
  }

  async function beginRestart() {
    if (!attempts || busy) return
    setErr(null)
    setBusy(true)
    try {
      const r = await attempts.startAttempt({ data: contentId })
      if ('error' in r) {
        if (r.error.includes('登录')) setLoggedIn(false)
        else setErr(r.error)
        return
      }
      setAttemptId(r.attemptId)
      setResults({})
      setIdx(0)
      setTypedVal('')
      ordersRef.current = {}
      setOpenAttempt(null)
      setPhase('quiz')
    } catch {
      setErr('网络不太顺，请再试一次。')
    } finally {
      setBusy(false)
    }
  }

  async function endQuiz() {
    if (!attempts || attemptId == null || busy) return
    setErr(null)
    setBusy(true)
    try {
      const r = await attempts.endAttempt({ data: { attemptId, lessonId: contentId } })
      if ('error' in r) {
        if (r.error.includes('登录')) setLoggedIn(false)
        else setErr(r.error)
        return
      }
      setScore(r)
      setOpenAttempt(null)
      setPhase('result')
    } catch {
      setErr('网络不太顺，请再试一次。')
    } finally {
      setBusy(false)
    }
  }

  const total = questions.length

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
          {phase === 'quiz' && total > 0 && (
            <span className="sr-quiz-count">
              {idx + 1} / {total}
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
          ) : loading ? (
            <p className="sr-quiz-empty">正在载入…</p>
          ) : total === 0 ? (
            <p className="sr-quiz-empty">这一课还没有练习题。</p>
          ) : phase === 'start' ? (
            <div className="sr-quiz-gate">
              {score ? (
                <ScoreCard score={score} title="上一次成绩" />
              ) : (
                <p className="sr-quiz-gate-note">
                  你上次有一份还没答完的记录，可以继续，或重新开始一份。
                </p>
              )}
              {err && <div className="sr-quiz-err">{err}</div>}
              <div className="sr-quiz-gate-actions">
                {openAttempt && (
                  <button type="button" className="sr-btn" disabled={busy} onClick={beginContinue}>
                    <Play size={15} /> 继续上一次
                  </button>
                )}
                <button
                  type="button"
                  className={openAttempt ? 'sr-btn ghost' : 'sr-btn'}
                  disabled={busy}
                  onClick={beginRestart}
                >
                  <RotateCcw size={15} /> 重新开始
                </button>
              </div>
            </div>
          ) : phase === 'result' && score ? (
            <div className="sr-quiz-gate">
              <ScoreCard score={score} title="本次成绩" />
              {err && <div className="sr-quiz-err">{err}</div>}
              <div className="sr-quiz-gate-actions">
                <button type="button" className="sr-btn" disabled={busy} onClick={beginRestart}>
                  <RotateCcw size={15} /> 再做一遍
                </button>
                <button type="button" className="sr-btn ghost" onClick={onClose}>
                  关闭
                </button>
              </div>
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
                            const r = await record({
                              data: { questionId: q.id, attemptId: attemptId ?? undefined },
                            })
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

        {phase === 'quiz' && q && loggedIn !== false && (
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
            {attempts && attemptId != null && (
              <button
                type="button"
                className="sr-btn ghost sr-quiz-end"
                disabled={busy}
                onClick={endQuiz}
                title="结束本课答题并查看成绩"
              >
                <Flag size={15} /> 结束本课答题
              </button>
            )}
            <button
              type="button"
              className="sr-btn"
              disabled={idx >= total - 1}
              onClick={() => {
                setErr(null)
                setTypedVal('')
                setIdx((i) => Math.min(total - 1, i + 1))
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

// The scorecard: correct count, ratio X/N, percentage (both shown), the wrong
// questions by 题号, plus unanswered and 说理 (self-checked, excluded) counts.
function ScoreCard({ score, title }: { score: ScoreSummary; title: string }) {
  const pct =
    score.gradableTotal > 0
      ? Math.round((score.correct / score.gradableTotal) * 100)
      : 0
  return (
    <div className="sr-score">
      <div className="sr-score-title">{title}</div>
      <div className="sr-score-hero">
        <span className="sr-score-pct">{pct}%</span>
        <span className="sr-score-ratio">
          答对 {score.correct} / {score.gradableTotal} 题
        </span>
      </div>
      <div className="sr-score-lines">
        {score.unanswered > 0 && (
          <div className="sr-score-line">未作答 {score.unanswered} 题（未得分）</div>
        )}
        {score.workTotal > 0 && (
          <div className="sr-score-line">
            说理 {score.workDone} / {score.workTotal} 题已完成（自评，不计入比例）
          </div>
        )}
        <div className="sr-score-line">
          {score.wrongOrds.length > 0 ? (
            <>
              答错的题：
              <span className="sr-score-wrong">
                {score.wrongOrds.map((o) => `第 ${o} 题`).join('、')}
              </span>
            </>
          ) : score.correct + score.unanswered > 0 && score.unanswered === 0 ? (
            '全部答对，太棒了。'
          ) : (
            '这一份没有答错的题。'
          )}
        </div>
      </div>
    </div>
  )
}
