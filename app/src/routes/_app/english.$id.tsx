import { useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Check, Languages, Loader2, Menu, Volume2 } from 'lucide-react'

import { getEnglishReading, getSentenceAudio } from '~/lib/english'
import { getLocale } from '~/lib/locale'
import { t } from '~/lib/i18n'
import { useLayoutStore } from '~/lib/layout-store'

// 短文学英语 — the READ phase (STEMROBIN-83). The learner reads the passage sentence
// by sentence, may hear each one narrated and may reveal its Chinese; only once every
// sentence is marked read does the recitation ladder (STEMROBIN-84) unlock.
//
// Per the course design there are deliberately NO comprehension questions here: the
// Chinese gloss carries understanding, and the later dictation verifies memory.
export const Route = createFileRoute('/_app/english/$id')({
  component: EnglishReadView,
  loader: async ({ params }) => ({
    id: params.id,
    reading: await getEnglishReading({ data: params.id }),
    locale: await getLocale(),
  }),
})

function EnglishReadView() {
  const { id, reading, locale } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const [read, setRead] = useState<Set<string>>(new Set())
  const [openGloss, setOpenGloss] = useState<Set<string>>(new Set())
  const [showAllGloss, setShowAllGloss] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  // Narration is fetched on click and cached, so opening a lesson does not pull
  // ~450KB of audio the learner may never play.
  const audioCache = useRef<Map<string, string>>(new Map())
  const playerRef = useRef<HTMLAudioElement | null>(null)

  if (!reading) {
    return (
      <main className="sr-detail">
        <div className="sr-empty">课文暂不可用</div>
      </main>
    )
  }

  const total = reading.sentences.length
  const doneCount = read.size
  const allRead = doneCount === total

  async function play(nodeId: string) {
    setPlaying(nodeId)
    try {
      let src = audioCache.current.get(nodeId)
      if (!src) {
        const clip = await getSentenceAudio({ data: { lessonId: id, nodeId } })
        if (!clip) return
        src = `data:${clip.mime};base64,${clip.b64}`
        audioCache.current.set(nodeId, src)
      }
      playerRef.current?.pause()
      const audio = new Audio(src)
      playerRef.current = audio
      audio.onended = () => setPlaying(null)
      await audio.play()
    } finally {
      setPlaying((cur) => (cur === nodeId ? null : cur))
    }
  }

  const toggleGloss = (sid: string) =>
    setOpenGloss((prev) => {
      const next = new Set(prev)
      next.has(sid) ? next.delete(sid) : next.add(sid)
      return next
    })

  const markRead = (sid: string) =>
    setRead((prev) => {
      const next = new Set(prev)
      next.add(sid)
      return next
    })

  return (
    <main className="sr-detail sr-en-read">
      <div className="sr-d-top">
        <button
          className="sr-navtoggle"
          aria-label={t(locale, 'cat.open')}
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
          <ArrowLeft size={16} /> {t(locale, 'lesson.back')}
        </Link>
      </div>

      <div className="sr-d-scroll">
        <header className="sr-en-head">
          <h1>{reading.title}</h1>
          <p>{t(locale, 'en.read.lead')}</p>
        </header>

      <div className="sr-en-toolbar">
        <span className="sr-en-progress">
          {allRead
            ? t(locale, 'en.read.done')
            : t(locale, 'en.read.progress', { done: doneCount, total })}
        </span>
        <button
          type="button"
          className="sr-btn ghost sr-en-allgloss"
          onClick={() => setShowAllGloss((v) => !v)}
        >
          <Languages size={15} aria-hidden />{' '}
          {showAllGloss ? t(locale, 'en.read.hideall') : t(locale, 'en.read.showall')}
        </button>
      </div>

      <ol className="sr-en-sentences">
        {reading.sentences.map((s) => {
          const isRead = read.has(s.id)
          const glossOpen = showAllGloss || openGloss.has(s.id)
          return (
            <li key={s.id} className={'sr-en-sentence' + (isRead ? ' read' : '')}>
              <span className="sr-en-num">{s.num}</span>
              <div className="sr-en-body">
                <p className="sr-en-en" onClick={() => toggleGloss(s.id)}>
                  {s.text}
                </p>
                {glossOpen && s.gloss && <p className="sr-en-zh">{s.gloss}</p>}
                <div className="sr-en-actions">
                  <button
                    type="button"
                    className="sr-en-act"
                    disabled={!s.hasAudio || playing === s.id}
                    onClick={() => play(s.id)}
                    aria-label={t(locale, 'en.read.play')}
                  >
                    {playing === s.id ? (
                      <Loader2 size={15} className="sr-spin" aria-hidden />
                    ) : (
                      <Volume2 size={15} aria-hidden />
                    )}
                    {t(locale, 'en.read.play')}
                  </button>
                  <button type="button" className="sr-en-act" onClick={() => toggleGloss(s.id)}>
                    <Languages size={15} aria-hidden /> {t(locale, 'en.read.gloss')}
                  </button>
                  <button
                    type="button"
                    className={'sr-en-act mark' + (isRead ? ' done' : '')}
                    onClick={() => markRead(s.id)}
                    disabled={isRead}
                  >
                    <Check size={15} aria-hidden />{' '}
                    {isRead ? t(locale, 'en.read.wasread') : t(locale, 'en.read.markread')}
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ol>

        <div className="sr-en-ladder">
          {allRead ? (
            // STEMROBIN-84 builds the ladder itself; the gate that reveals it is this
            // ticket's acceptance criterion, so the entry appears but is not yet wired.
            <button type="button" className="sr-btn primary" disabled>
              {t(locale, 'en.ladder.soon')}
            </button>
          ) : (
            <span className="sr-en-ladder-locked">{t(locale, 'en.read.locked')}</span>
          )}
        </div>
      </div>
    </main>
  )
}
