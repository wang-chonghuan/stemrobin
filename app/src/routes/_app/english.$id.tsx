import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Download, FileAudio, Languages, Loader2, Menu, Volume2 } from 'lucide-react'

import {
  getEnglishReading,
  getSentenceAudio,
  getWordAudio,
  FULL_AUDIO_NODE,
  type EnglishVocab,
  type Pattern,
} from '~/lib/english'
import { getLessonPdf } from '~/lib/lessons'
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
  const [openGloss, setOpenGloss] = useState<Set<string>>(new Set())
  const [showAllGloss, setShowAllGloss] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  // Narration is fetched on click and cached, so opening a lesson does not pull
  // ~450KB of audio the learner may never play. The cache key includes the lesson
  // id: this route component is REUSED across /english/$id navigations, so a cache
  // keyed only by node id would serve lesson 1's "s1" clip on lesson 2.
  const audioCache = useRef<Map<string, string>>(new Map())
  const playerRef = useRef<HTMLAudioElement | null>(null)

  // Same reuse hazard for the per-lesson UI state — reset it (and stop any playing
  // clip) whenever the lesson changes, or open glosses would leak between lessons.
  useEffect(() => {
    setOpenGloss(new Set())
    setShowAllGloss(false)
    setPlaying(null)
    audioCache.current.clear()
    playerRef.current?.pause()
    playerRef.current = null
  }, [id])

  if (!reading) {
    return (
      <main className="sr-detail">
        <div className="sr-empty">课文暂不可用</div>
      </main>
    )
  }

  // One player for all three audio layers (sentence, whole passage, single word).
  // Every clip is PRE-RENDERED TTS fetched on demand and cached; the browser's own
  // speech synthesis is deliberately not used anywhere.
  async function playClip(key: string, fetchClip: () => Promise<{ mime: string; b64: string } | null>) {
    setPlaying(key)
    try {
      let src = audioCache.current.get(key)
      if (!src) {
        const clip = await fetchClip()
        if (!clip) return
        src = `data:${clip.mime};base64,${clip.b64}`
        audioCache.current.set(key, src)
      }
      playerRef.current?.pause()
      const audio = new Audio(src)
      playerRef.current = audio
      audio.onended = () => setPlaying(null)
      await audio.play()
    } finally {
      setPlaying((cur) => (cur === key ? null : cur))
    }
  }

  const play = (nodeId: string) =>
    playClip(`${id}:${nodeId}`, () => getSentenceAudio({ data: { lessonId: id, nodeId } }))
  const playFull = () => play(FULL_AUDIO_NODE)
  // Word clips are course-global, so they are cached by word rather than by lesson.
  const speakWord = (word: string) => playClip(`w:${word}`, () => getWordAudio({ data: word }))

  const toggleGloss = (sid: string) =>
    setOpenGloss((prev) => {
      const next = new Set(prev)
      next.has(sid) ? next.delete(sid) : next.add(sid)
      return next
    })

  async function downloadPdf() {
    const b64 = await getLessonPdf({ data: id })
    if (!b64) return
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${reading!.seq}. ${reading!.title}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

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
        <button
          type="button"
          className="sr-icontool"
          style={{ marginLeft: 'auto' }}
          onClick={downloadPdf}
          aria-label={t(locale, 'lesson.pdf')}
          title={t(locale, 'lesson.pdf')}
        >
          <Download size={17} />
        </button>
        {/* 跟读练习音频 (STEMROBIN-108): a plain link to the attachment route, so one
            click saves the file — no player, no base64 round-trip through the page. */}
        {reading.hasPracticeAudio && (
          <a
            className="sr-icontool"
            href={`/english-audio/${id}`}
            download
            aria-label={t(locale, 'en.audio.download')}
            title={t(locale, 'en.audio.download')}
          >
            <FileAudio size={17} />
          </a>
        )}
      </div>

      <div className="sr-d-scroll">
        <header className="sr-en-head">
          <h1>
            <span className="sr-en-seq">{reading.seq}.</span> {reading.title}
          </h1>
        </header>

        <div className="sr-en-toolbar">
          <Link
            to="/english/$id/recite"
            params={{ id }}
            className="sr-btn primary"
            style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          >
            {t(locale, 'en.ladder.enter')}
          </Link>
          {reading.hasFullAudio && (
            <button
              type="button"
              className="sr-btn ghost sr-en-allgloss"
              onClick={playFull}
              disabled={playing === `${id}:${FULL_AUDIO_NODE}`}
            >
              {playing === `${id}:${FULL_AUDIO_NODE}` ? (
                <Loader2 size={15} className="sr-spin" aria-hidden />
              ) : (
                <Volume2 size={15} aria-hidden />
              )}{' '}
              {t(locale, 'en.read.playall')}
            </button>
          )}
          <button
            type="button"
            className="sr-btn ghost sr-en-allgloss"
            onClick={() => setShowAllGloss((v) => !v)}
          >
            <Languages size={15} aria-hidden />{' '}
            {showAllGloss ? t(locale, 'en.read.hideall') : t(locale, 'en.read.showall')}
          </button>
        </div>

        {/* 句型卡 — the blueprint makes patterns the point of the lesson, so they lead
            the page. Each shows its template (slots highlighted) and its 中文. */}
        {reading.patterns.length > 0 && (
          <section className="sr-en-patterns">
            <h2 className="sr-en-vocab-title">{t(locale, 'en.patterns.title')}</h2>
            <ul className="sr-en-pattern-list">
              {reading.patterns.map((p) => (
                <li key={p.id} className="sr-en-pattern">
                  <p className="sr-en-pattern-en">{renderTemplate(p)}</p>
                  {p.zh && <p className="sr-en-pattern-zh">{p.zh}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Whole passage in one card; sentences separated by a divider (border-top on
            every row but the first). Audio + Chinese controls sit at the right end. */}
        <div className="sr-en-card">
          {reading.sentences.map((s) => {
            const glossOpen = showAllGloss || openGloss.has(s.id)
            return (
              <div key={s.id} className="sr-en-row">
                <div className="sr-en-line">
                  <span className="sr-en-num">{s.num}</span>
                  <p className="sr-en-en" onClick={() => toggleGloss(s.id)}>
                    {s.speaker && <span className="sr-en-speaker">{s.speaker}:</span>}
                    {s.text}
                  </p>
                  <div className="sr-en-actions">
                    <button
                      type="button"
                      className="sr-en-icon"
                      disabled={!s.hasAudio || playing === `${id}:${s.id}`}
                      onClick={() => play(s.id)}
                      aria-label={t(locale, 'en.read.play')}
                      title={t(locale, 'en.read.play')}
                    >
                      {playing === `${id}:${s.id}` ? (
                        <Loader2 size={17} className="sr-spin" aria-hidden />
                      ) : (
                        <Volume2 size={17} aria-hidden />
                      )}
                    </button>
                    <button
                      type="button"
                      className={'sr-en-icon' + (glossOpen ? ' on' : '')}
                      onClick={() => toggleGloss(s.id)}
                      aria-label={t(locale, 'en.read.gloss')}
                      title={t(locale, 'en.read.gloss')}
                      aria-pressed={glossOpen}
                    >
                      <Languages size={17} aria-hidden />
                    </button>
                  </div>
                </div>
                {glossOpen && s.gloss && <p className="sr-en-zh">{s.gloss}</p>}
              </div>
            )
          })}
        </div>

        {(reading.newWords.length > 0 || reading.reviewWords.length > 0) && (
          <section className="sr-en-vocab">
            <h2 className="sr-en-vocab-title">{t(locale, 'en.vocab.title')}</h2>
            {reading.newWords.length > 0 && (
              <VocabGroup label={t(locale, 'en.vocab.new')} tone="new" words={reading.newWords} onSpeak={speakWord} speakLabel={t(locale, 'en.read.play')} />
            )}
            {reading.reviewWords.length > 0 && (
              <VocabGroup label={t(locale, 'en.vocab.review')} tone="review" words={reading.reviewWords} onSpeak={speakWord} speakLabel={t(locale, 'en.read.play')} />
            )}
          </section>
        )}
      </div>
    </main>
  )
}

// A pattern template with its `___` slots highlighted — the slot is what the learner
// swaps words into, and what the ladder blanks first.
function renderTemplate(p: Pattern) {
  return p.template.split(/(___)/g).map((part, i) =>
    part === '___' ? (
      <span key={i} className="sr-en-slot">___</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

// One labelled 中英对照 group of the 生词表 (新词 or 复习). Each word has a small
// speaker that pronounces it with the browser's built-in TTS (onSpeak).
function VocabGroup({
  label,
  tone,
  words,
  onSpeak,
  speakLabel,
}: {
  label: string
  tone: 'new' | 'review'
  words: EnglishVocab[]
  onSpeak: (word: string) => void
  speakLabel: string
}) {
  return (
    <div className="sr-en-vocab-group">
      <span className={`sr-en-vocab-label ${tone}`}>{label}</span>
      <ul className="sr-en-vocab-list">
        {words.map((v) => (
          <li key={v.en} className="sr-en-vocab-item">
            <span className="sr-en-vocab-en">{v.en}</span>
            <button
              type="button"
              className="sr-en-icon sr-en-word-say"
              onClick={() => onSpeak(v.en)}
              aria-label={speakLabel}
              title={speakLabel}
            >
              <Volume2 size={14} aria-hidden />
            </button>
            <span className="sr-en-vocab-zh">{v.zh}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
