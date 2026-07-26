import { createFileRoute, Link } from '@tanstack/react-router'
import {
  BookOpen,
  Brain,
  FileText,
  GraduationCap,
  Layers,
  Menu,
  Sparkles,
  Zap,
} from 'lucide-react'

import { getAvailableTextbookLessons } from '~/lib/textbooks'
import { listAvailableLessonIds } from '~/lib/lessons'
import { deckPercentages, getDeckStats } from '~/lib/deck-stats'
import { getLocale } from '~/lib/locale'
import { getCurrentUser } from '~/lib/session'
import { t } from '~/lib/i18n'
import { useLayoutStore } from '~/lib/layout-store'

export const Route = createFileRoute('/_app/')({
  component: Overview,
  loader: async () => ({
    lessonIds: await listAvailableLessonIds(),
    locale: await getLocale(),
    stats: await getDeckStats(),
    user: await getCurrentUser(),
  }),
})

// One of the three deck numbers: a bar, its percentage, and the denominator it
// was taken over — a percentage alone hides whether it is 2 cards or 200.
function Stat({
  label,
  pct,
  sub,
  tone,
}: {
  label: string
  pct: number
  sub: string
  tone: 'progress' | 'accuracy' | 'mastery'
}) {
  return (
    <div className="sr-stat">
      <div className="sr-stat-top">
        <span className="sr-stat-label">{label}</span>
        <span className="sr-stat-pct sr-num">{pct}%</span>
      </div>
      <div className={'sr-stat-bar ' + tone}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="sr-stat-sub">{sub}</p>
    </div>
  )
}

// Supporting principles under the retrieval-practice hero (i18n keys ov.learn.*).
const PRINCIPLES = [
  { k: 'p1', icon: Layers },
  { k: 'p2', icon: Zap },
  { k: 'p3', icon: GraduationCap },
  { k: 'p4', icon: Sparkles },
] as const

function Overview() {
  const { lessonIds, locale, stats, user } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const availableLessons = getAvailableTextbookLessons(lessonIds, locale)
  // Show only the 6 most-recent lessons (curriculum order is ascending, so the
  // newest live content is at the tail).
  const newLessons = availableLessons.slice(-6)
  const pct = deckPercentages(stats)
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
            <h1 className="sr-hero-title">
              <span className="sr-hero-accent">{t(locale, 'ov.hero.title.subject')}</span>
              {t(locale, 'ov.hero.title.mid')}
              <span className="sr-hero-accent">{t(locale, 'ov.hero.title.quality')}</span>
              {t(locale, 'ov.hero.title.tail')}
            </h1>
            {/* What the course spans, then how it is built — both inside the
                rule, one line each. */}
            <ul className="sr-hero-points">
              <li>{t(locale, 'ov.hero.line.a')}</li>
              <li>{t(locale, 'ov.hero.line.b')}</li>
            </ul>
            <p className="sr-hero-free">
              {t(locale, 'ov.hero.free.a')}
              <Link to="/login" className="sr-textbtn">
                {t(locale, 'ov.hero.free.cta')}
              </Link>
              {t(locale, 'ov.hero.free.b')}
            </p>
          </div>
          {/* Brand illustration: a tree of knowledge whose branches end in lit
              nodes, wrapped in atom orbits. Intrinsic size is stated so the
              hero never reflows once the image lands; CSS sets the display
              width (see .sr-hero-art). */}
          <img
            className="sr-hero-art"
            src="/hero-art.png"
            alt={t(locale, 'ov.hero.art.alt')}
            width={360}
            height={392}
          />
        </section>

        {/* Three numbers over the card deck. Coverage, a rate, and a state —
            different kinds of number, which is why each carries its own
            denominator underneath rather than a bare percentage. */}
        <section className="sr-stats">
          <div className="sr-stats-top">
            <span className="sr-stats-title">{t(locale, 'deck.stats')}</span>
            {!user && (
              <span className="sr-stats-guest">
                {t(locale, 'ov.progress.guest')}{' '}
                <Link to="/login" className="sr-progress-guest-cta">
                  {t(locale, 'ov.progress.guest.cta')}
                </Link>
              </span>
            )}
          </div>
          <div className="sr-stats-row">
            <Stat
              label={t(locale, 'deck.stats.progress')}
              pct={pct.progress}
              tone="progress"
              sub={t(locale, 'deck.stats.progress.sub', {
                n: stats.seenCards,
                total: stats.totalCards,
              })}
            />
            <Stat
              label={t(locale, 'deck.stats.accuracy')}
              pct={pct.accuracy}
              tone="accuracy"
              sub={t(locale, 'deck.stats.accuracy.sub', { n: stats.answered })}
            />
            <Stat
              label={t(locale, 'deck.stats.mastery')}
              pct={pct.mastery}
              tone="mastery"
              sub={t(locale, 'deck.stats.mastery.sub', { n: stats.passedCards })}
            />
          </div>
        </section>

        {/* Learn: pedagogy explainer (left, growth) + new lessons (right).
            Desktop = two columns; mobile = lessons first, principle below. */}
        {/* The lesson grid is omitted entirely while no outline lesson has
            content yet, so the principle column takes the full width rather
            than sitting beside an empty half. */}
        <section className={'sr-section-gap sr-learn' + (newLessons.length ? '' : ' sr-learn-solo')}>
          {newLessons.length > 0 && (
            <div className="sr-learn-courses">
              <div className="sr-eyebrow">{t(locale, 'ov.new', { n: newLessons.length })}</div>
              <div className="sr-grid">
                {newLessons.map((l) => (
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
            </div>
          )}

          <aside className="sr-learn-principle sr-card">
            <div className="sr-eyebrow accent">{t(locale, 'ov.learn.eyebrow')}</div>
            <h2 className="sr-learn-title">{t(locale, 'ov.learn.title')}</h2>
            <p className="sr-learn-sub">{t(locale, 'ov.learn.sub')}</p>

            {/* hero principle — retrieval practice (the star) */}
            <div className="sr-learn-hero">
              <div className="sr-learn-hero-head">
                <Brain size={17} />
                <b>{t(locale, 'ov.learn.p0.t')}</b>
              </div>
              <p>{t(locale, 'ov.learn.p0.d')}</p>
            </div>

            <ul className="sr-learn-list">
              {PRINCIPLES.map((p) => (
                <li key={p.k}>
                  <span className="sr-learn-ic">
                    <p.icon size={15} />
                  </span>
                  <span className="sr-learn-item-body">
                    <b>{t(locale, `ov.learn.${p.k}.t`)}</b>
                    <span>{t(locale, `ov.learn.${p.k}.d`)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </section>
      </div>
    </main>
  )
}
