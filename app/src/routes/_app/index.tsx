import { createFileRoute, Link } from '@tanstack/react-router'
import { BookOpen, FileText, Menu } from 'lucide-react'

import { getAvailableLessons } from '~/lib/curriculum'
import { listAvailableLessonIds } from '~/lib/lessons'
import { getProgress } from '~/lib/progress'
import { getLocale } from '~/lib/locale'
import { t } from '~/lib/i18n'
import { useLayoutStore } from '~/lib/layout-store'

export const Route = createFileRoute('/_app/')({
  component: Overview,
  loader: async () => ({
    lessonIds: await listAvailableLessonIds(),
    locale: await getLocale(),
    progress: await getProgress(),
  }),
})

function Overview() {
  const { lessonIds, locale, progress } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const availableLessons = getAvailableLessons(lessonIds, locale)
  // Real learner progress (STEMROBIN-30): completed points over total points
  // (2 × lessons). Reading points (all cards read) + practice points (latest
  // attempt >= 80). Practice points can regress on a later low attempt.
  const readingDone = progress.lessons.filter((l) => l.readingComplete).length
  const practiceDone = progress.lessons.filter((l) => l.practiceComplete).length
  const pctWidth =
    progress.totalPoints > 0
      ? (progress.completedPoints / progress.totalPoints) * 100
      : 0
  return (
    <main className="sr-detail">
      <div className="sr-d-top">
        <button
          className="sr-navtoggle"
          aria-label={t(locale, 'cat.open')}
          type="button"
          onClick={() => setDrawer(true)}
        >
          <Menu size={18} />
        </button>
        <BookOpen size={18} color="var(--sr-blue)" />
        <span className="sr-d-title">{t(locale, 'ov.title')}</span>
      </div>

      <div className="sr-d-scroll">
        {/* Hero — product intro (STEMROBIN-57) */}
        <section className="sr-hero">
          <div className="sr-hero-copy">
            <span className="sr-hero-badge">{t(locale, 'ov.hero.badge')}</span>
            <h1 className="sr-hero-title">
              {t(locale, 'ov.hero.title.a')}
              <span className="sr-hero-accent">{t(locale, 'ov.hero.title.b')}</span>
            </h1>
            <p className="sr-hero-desc">{t(locale, 'ov.hero.desc')}</p>
          </div>
          <HeroArt />
        </section>

        {/* Progress — real, from getProgress() (STEMROBIN-30) */}
        <section className="sr-progress">
          <div className="sr-progress-top">
            <span className="sr-progress-title">{t(locale, 'ov.progress.title')}</span>
            <span className="sr-progress-pct">
              {progress.completedPoints}
              <span> / {progress.totalPoints} {t(locale, 'ov.progress.unit')}</span>
            </span>
          </div>
          <div className="sr-progress-bar">
            <span style={{ width: `${pctWidth}%` }} />
          </div>
          <div className="sr-progress-stats">
            <div className="sr-progress-stat">
              <b>{readingDone}</b>
              <span>{t(locale, 'ov.stat.learned')}</span>
            </div>
            <div className="sr-progress-stat">
              <b>{practiceDone}</b>
              <span>{t(locale, 'ov.stat.practiced')}</span>
            </div>
          </div>
        </section>

        {/* Live lessons */}
        <section className="sr-section-gap">
          <div className="sr-eyebrow">{t(locale, 'ov.new', { n: availableLessons.length })}</div>
          <div className="sr-grid">
            {availableLessons.map((l) => (
              <Link
                key={l.id}
                to="/lesson/$id"
                params={{ id: l.id }}
                className="sr-card sr-lesson-card"
              >
                <span className="sr-lesson-card-ico">
                  <FileText size={17} />
                </span>
                <span className="sr-lesson-card-body">
                  <span className="sr-card-title">{l.title}</span>
                  <span className="sr-note">{l.subject}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

// On-brand "card → mastery" motif: a lesson card whose correct option is checked
// (instant feedback), rising over ascending steps (keep going / learn ahead).
// Three-hue DESIGN palette, inline SVG (no image files).
function HeroArt() {
  return (
    <svg
      className="sr-hero-art"
      viewBox="0 0 300 210"
      role="img"
      aria-label="卡片式学习：答对即时反馈，一步步往上"
    >
      {/* ascending steps + upward arrow (progress / learn ahead) */}
      <rect x="196" y="150" width="26" height="44" rx="6" fill="#E1F1F5" />
      <rect x="228" y="118" width="26" height="76" rx="6" fill="#E1F1F5" />
      <rect x="260" y="86" width="26" height="108" rx="6" fill="#CFE8F0" />
      <path
        d="M198 150 L284 74"
        fill="none"
        stroke="#0A5E76"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M284 74 L270 76 M284 74 L282 88" fill="none" stroke="#0A5E76" strokeWidth="3" strokeLinecap="round" />
      {/* lesson card */}
      <rect x="14" y="26" width="172" height="158" rx="16" fill="#FFFFFF" stroke="#0E7C9B" strokeWidth="2.5" />
      <rect x="34" y="48" width="118" height="9" rx="4.5" fill="#E3EAE9" />
      <rect x="34" y="65" width="88" height="9" rx="4.5" fill="#E3EAE9" />
      <rect x="34" y="92" width="132" height="22" rx="8" fill="#F5F9F9" stroke="#E3EAE9" />
      <rect x="34" y="122" width="132" height="22" rx="8" fill="#E4F6EE" stroke="#15A06A" strokeWidth="1.6" />
      <circle cx="151" cy="133" r="9.5" fill="#15A06A" />
      <path d="M147 133 l3 3 l5 -6" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="34" y="152" width="132" height="22" rx="8" fill="#F5F9F9" stroke="#E3EAE9" />
    </svg>
  )
}
