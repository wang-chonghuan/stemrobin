import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Camera, Check, X } from 'lucide-react'

import { getCurrentUser } from '~/lib/session'
import { getLessonQuestions, recordAnswer } from '~/lib/quiz'
import type { QuizQuestion, AnswerResult } from '~/lib/quiz'

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

type Result = AnswerResult | null

export function QuizDrawer({
  lessonId,
  open,
  onClose,
}: {
  lessonId: string
  open: boolean
  onClose: () => void
}) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<Record<number, Result>>({})
  const [pending, setPending] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setIdx(0)
    setResults({})
    getCurrentUser().then((u) => setLoggedIn(!!u))
    getLessonQuestions({ data: lessonId }).then(setQuestions)
  }, [open, lessonId])

  const q = questions[idx]
  useEffect(() => {
    // Re-typeset whenever the visible card or its revealed answer changes.
    const t = setTimeout(() => renderMath(cardRef.current), 0)
    return () => clearTimeout(t)
  }, [idx, questions, results, open, loggedIn])

  if (!open) return null

  const result = q ? results[q.id] ?? null : null

  async function choose(optIndex: number) {
    if (!q || pending || results[q.id]) return
    setPending(true)
    try {
      const r = await recordAnswer({
        data: { questionId: q.id, chosen: optIndex },
      })
      if ('error' in r) {
        if (r.error.includes('登录')) setLoggedIn(false)
      } else {
        setResults((m) => ({ ...m, [q.id]: r }))
      }
    } finally {
      setPending(false)
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

        <div className="sr-quiz-body" ref={cardRef}>
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
              <div className="sr-quiz-ptype">{q.type}</div>
              <div className="sr-quiz-prompt">{q.prompt}</div>

              {q.answerMode === 'work' ? (
                <div className="sr-quiz-work">
                  <Camera size={26} />
                  <span>需要写步骤，拍照上传（即将支持）</span>
                </div>
              ) : (
                <ul className="sr-quiz-options">
                  {(q.options ?? []).map((opt, i) => {
                    const answered = !!result
                    const isCorrect = answered && i === result!.correctIndex
                    const isChosenWrong =
                      answered &&
                      !result!.isCorrect &&
                      i !== result!.correctIndex
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          className={
                            'sr-quiz-opt' +
                            (isCorrect ? ' correct' : '') +
                            (isChosenWrong ? ' dim' : '')
                          }
                          disabled={answered || pending}
                          onClick={() => choose(i)}
                        >
                          <span className="sr-quiz-opt-text">{opt}</span>
                          {isCorrect && <Check size={16} />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {result && (
                <div className="sr-quiz-feedback">
                  <div
                    className={
                      'sr-quiz-verdict' + (result.isCorrect ? ' ok' : '')
                    }
                  >
                    {result.isCorrect ? '答对了' : '再想想 · 正确答案已标出'}
                  </div>
                  <div className="sr-quiz-answer">{result.answer}</div>
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
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
            >
              上一题
            </button>
            <button
              type="button"
              className="sr-btn"
              disabled={idx >= questions.length - 1}
              onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
            >
              下一题
            </button>
          </footer>
        )}
      </section>
    </div>
  )
}
