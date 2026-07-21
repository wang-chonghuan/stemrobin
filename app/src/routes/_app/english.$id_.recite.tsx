import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Check, Languages, Menu } from 'lucide-react'

import { getRecitation, recordRecite, getSentenceHint, getEnglishReading, type Level } from '~/lib/english'
import { getLocale } from '~/lib/locale'
import { t } from '~/lib/i18n'
import { useLayoutStore } from '~/lib/layout-store'

// 背诵天梯 (STEMROBIN-89). Five levels over the SAME passage, blanking a rising share
// of the words: ~20/40/60/80% and finally the whole text. Level n's blanks contain
// level n-1's, and level 1 blanks the pattern's slot words first, so the learner
// first recalls the swappable part while the template frame is still visible.
//
// Two rules from the course design shape the state here:
//   * the 中文 hint is available at EVERY level, but a sentence answered with a hint
//     (or after the answer was shown) is only "辅助完成" — it re-enters the queue and
//     must be produced again cleanly before the level counts as passed;
//   * a wrong answer marks POSITIONS, never the expected word — grading is server-side
//     and the passage is not in the payload (see projectRecitation).
export const Route = createFileRoute('/_app/english/$id_/recite')({
  component: ReciteView,
  loader: async ({ params }) => ({
    id: params.id,
    reading: await getEnglishReading({ data: params.id }),
    locale: await getLocale(),
  }),
})

const LEVELS: Level[] = [1, 2, 3, 4, 5]

function ReciteView() {
  const { id, reading, locale } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const [level, setLevel] = useState<Level>(1)
  const [sentences, setSentences] = useState<Awaited<ReturnType<typeof getRecitation>>>(null)
  // queue = sentence ids still owed a clean pass at this level
  const [queue, setQueue] = useState<string[]>([])
  const [assisted, setAssisted] = useState<Set<string>>(new Set())
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [wrong, setWrong] = useState<Record<string, number[]>>({})
  const [hint, setHint] = useState<Record<string, string>>({})
  const [fullText, setFullText] = useState('')
  const [fullResult, setFullResult] = useState<null | { isCorrect: boolean; wrong: number[] }>(null)
  const [passed, setPassed] = useState<Set<Level>>(new Set())

  useEffect(() => {
    let live = true
    setSentences(null); setQueue([]); setAssisted(new Set()); setAnswers({})
    setWrong({}); setHint({}); setFullText(''); setFullResult(null)
    getRecitation({ data: { lessonId: id, level } }).then((s) => {
      if (!live || !s) return
      setSentences(s)
      setQueue(s.map((x) => x.id))
    })
    return () => { live = false }
  }, [id, level])

  const total = sentences?.length ?? 0
  const done = total - queue.length
  const current = useMemo(() => sentences?.find((s) => s.id === queue[0]) ?? null, [sentences, queue])

  if (!reading) return <main className="sr-detail"><div className="sr-empty">课文暂不可用</div></main>

  async function submitSentence() {
    if (!current) return
    const given = answers[current.id] ?? []
    const res = await recordRecite({
      data: { lessonId: id, level, nodeId: current.id, answers: given, assisted: assisted.has(current.id) },
    })
    if ('error' in res) return
    if (res.isCorrect) {
      setWrong((w) => ({ ...w, [current.id]: [] }))
      // A hinted sentence is graded but does not count: it goes to the back of the
      // queue to be produced again without help.
      if (assisted.has(current.id)) {
        setQueue((q) => [...q.slice(1), current.id])
        setAssisted((a) => { const n = new Set(a); n.delete(current.id); return n })
        setAnswers((a) => ({ ...a, [current.id]: [] }))
        setHint((h) => { const n = { ...h }; delete n[current.id]; return n })
      } else {
        setQueue((q) => q.slice(1))
      }
    } else {
      setWrong((w) => ({ ...w, [current.id]: res.wrong }))
    }
  }

  async function askHint() {
    if (!current) return
    const { zh } = await getSentenceHint({ data: { lessonId: id, nodeId: current.id } })
    if (zh) setHint((h) => ({ ...h, [current.id]: zh }))
    setAssisted((a) => new Set(a).add(current.id))
  }

  async function submitFull() {
    const res = await recordRecite({ data: { lessonId: id, level: 5, text: fullText, assisted: false } })
    if ('error' in res) return
    setFullResult(res)
    if (res.isCorrect) setPassed((p) => new Set(p).add(5))
  }

  // a level is passed when its queue empties (or, at L5, on a clean whole-text pass)
  useEffect(() => {
    if (level < 5 && sentences && total > 0 && queue.length === 0) {
      setPassed((p) => new Set(p).add(level))
    }
  }, [queue, sentences, total, level])

  return (
    <main className="sr-detail sr-en-read">
      <div className="sr-d-top">
        <button className="sr-navtoggle" aria-label={t(locale, 'cat.open')} type="button" onClick={() => setDrawer(true)}>
          <Menu size={18} />
        </button>
        <Link
          to="/english/$id"
          params={{ id }}
          className="sr-btn ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}
        >
          <ArrowLeft size={16} /> {t(locale, 'en.recite.back')}
        </Link>
      </div>

      <div className="sr-d-scroll">
        <header className="sr-en-head">
          <h1><span className="sr-en-seq">{reading.seq}.</span> {reading.title}</h1>
        </header>

        {/* the ladder itself — five rungs, the last one whole-passage recitation */}
        <div className="sr-en-ladder-bar">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              className={'sr-en-rung' + (l === level ? ' active' : '') + (passed.has(l) ? ' passed' : '')}
              onClick={() => setLevel(l)}
            >
              {passed.has(l) && <Check size={13} aria-hidden />}
              {t(locale, `en.recite.l${l}`)}
            </button>
          ))}
        </div>

        {level < 5 ? (
          <>
            <div className="sr-en-toolbar">
              <span className="sr-en-progress">
                {t(locale, 'en.recite.progress', { done, total })}
              </span>
            </div>
            {current ? (
              <div className="sr-en-card">
                <div className="sr-en-row">
                  {current.speaker && <span className="sr-en-speaker">{current.speaker}:</span>}
                  <p className="sr-en-en">
                    {current.tokens.map((tok, i) =>
                      'hidden' in tok ? (
                        <input
                          key={i}
                          className={'sr-en-blank' + ((wrong[current.id] ?? []).includes(blankIndex(current.tokens, i)) ? ' bad' : '')}
                          value={(answers[current.id] ?? [])[blankIndex(current.tokens, i)] ?? ''}
                          onChange={(e) => {
                            const bi = blankIndex(current.tokens, i)
                            setAnswers((a) => {
                              const cur = [...(a[current.id] ?? [])]
                              cur[bi] = e.target.value
                              return { ...a, [current.id]: cur }
                            })
                          }}
                          aria-label={t(locale, 'en.recite.blank')}
                        />
                      ) : (
                        <span key={i}>{tok.w}</span>
                      ),
                    )}
                  </p>
                  {hint[current.id] && <p className="sr-en-zh">{hint[current.id]}</p>}
                  {(wrong[current.id]?.length ?? 0) > 0 && (
                    <p className="sr-en-badnote">{t(locale, 'en.recite.wrong')}</p>
                  )}
                  {assisted.has(current.id) && (
                    <p className="sr-en-assisted">{t(locale, 'en.recite.assisted')}</p>
                  )}
                  <div className="sr-en-actions">
                    <button type="button" className="sr-btn primary" onClick={submitSentence}>
                      {t(locale, 'en.recite.submit')}
                    </button>
                    <button type="button" className="sr-btn ghost" onClick={askHint}>
                      <Languages size={15} aria-hidden /> {t(locale, 'en.recite.hint')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="sr-en-card">
                <div className="sr-en-row">
                  <p className="sr-en-en">{t(locale, 'en.recite.levelDone')}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="sr-en-card">
            <div className="sr-en-row">
              <p className="sr-en-zh">{t(locale, 'en.recite.fullLead')}</p>
              <textarea
                className="sr-en-fulltext"
                rows={8}
                value={fullText}
                onChange={(e) => setFullText(e.target.value)}
                placeholder={t(locale, 'en.recite.fullPlaceholder')}
              />
              {fullResult && (
                <p className={fullResult.isCorrect ? 'sr-en-assisted' : 'sr-en-badnote'}>
                  {fullResult.isCorrect
                    ? t(locale, 'en.recite.fullOk')
                    : t(locale, 'en.recite.fullBad', { n: fullResult.wrong.length })}
                </p>
              )}
              <div className="sr-en-actions">
                <button type="button" className="sr-btn primary" onClick={submitFull}>
                  {t(locale, 'en.recite.submit')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

// which blank (0-based among the hidden slots) a given token index is
function blankIndex(tokens: { w?: string; isWord: boolean }[], idx: number): number {
  let n = 0
  for (let i = 0; i < idx; i++) if (!('w' in tokens[i]) && tokens[i].isWord) n++
  return n
}
