// The app's own entry, inside the catalog shell: where "start learning" from
// the landing lands. It carries no pitch — the landing at `/` already made the
// argument — only the deck's own numbers and the lessons that have content.

import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { BookOpen, FileText, Menu } from 'lucide-react'

import { getAvailableTextbookLessons } from '~/lib/textbooks'
import { listAvailableLessonIds } from '~/lib/lessons'
import { deckPercentages, getDeckStats } from '~/lib/deck-stats'
import { getLocale } from '~/lib/locale'
import { getCurrentUser } from '~/lib/session'
import { t } from '~/lib/i18n'
import { useLayoutStore } from '~/lib/layout-store'

export const Route = createFileRoute('/_app/learn')({
  // The one gated surface: progress, accuracy and mastery are per-learner, so
  // there is nothing to show a visitor who has not signed in. Lessons and the
  // curriculum stay open — the wall is here, not on the content.
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
  },
  component: Learn,
  loader: async () => ({
    lessonIds: await listAvailableLessonIds(),
    locale: await getLocale(),
    stats: await getDeckStats(),
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

function Learn() {
  const { lessonIds, locale, stats } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const availableLessons = getAvailableTextbookLessons(lessonIds, locale)
  // Curriculum order is ascending, so the newest live content is at the tail.
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
        {/* Coverage, a rate, and a state — different kinds of number, which is
            why each carries its own denominator rather than a bare percentage. */}
        <section className="sr-stats">
          <div className="sr-stats-top">
            <span className="sr-stats-title">{t(locale, 'deck.stats')}</span>
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

        {/* Lessons that have content, newest last. Nothing renders while the
            deck is still an outline — the catalog rail is the way in then. */}
        {newLessons.length > 0 && (
          <section className="sr-section-gap">
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
          </section>
        )}
      </div>
    </main>
  )
}
