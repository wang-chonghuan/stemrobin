import { createFileRoute, Link } from '@tanstack/react-router'
import { Atom, BookOpen, FileText, Menu, Rocket } from 'lucide-react'

import { getAvailableLessons } from '~/lib/curriculum'
import { listAvailableLessonIds } from '~/lib/lessons'
import { getLocale } from '~/lib/locale'
import { t } from '~/lib/i18n'
import { useLayoutStore } from '~/lib/layout-store'

export const Route = createFileRoute('/_app/')({
  component: Overview,
  loader: async () => ({
    lessonIds: await listAvailableLessonIds(),
    locale: await getLocale(),
  }),
})

function Overview() {
  const { lessonIds, locale } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const availableLessons = getAvailableLessons(lessonIds, locale)
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
        {/* Progress (mockup — wire to sr_answer_events / sr_progress later) */}
        <section className="sr-progress">
          <div className="sr-progress-top">
            <span className="sr-progress-title">{t(locale, 'ov.progress.title')}</span>
            <span className="sr-progress-pct">
              8<span> {t(locale, 'ov.progress.unit')}</span>
            </span>
          </div>
          <div className="sr-progress-bar">
            <span style={{ width: '8.3%' }} />
          </div>
          <div className="sr-progress-stats">
            <div className="sr-progress-stat">
              <b>8</b>
              <span>{t(locale, 'ov.stat.learned')}</span>
            </div>
            <div className="sr-progress-stat">
              <b>104</b>
              <span>{t(locale, 'ov.stat.practiced')}</span>
            </div>
            <div className="sr-progress-stat">
              <b>5</b>
              <span>{t(locale, 'ov.stat.streak')}</span>
            </div>
          </div>
        </section>

        {/* Two pillars */}
        <section className="sr-section-gap">
          <div className="sr-pillars">
            <div className="sr-pillar">
              <span className="sr-pillar-ico blue"><Atom size={20} /></span>
              <div>
                <div className="sr-pillar-title">{t(locale, 'ov.pillar1.title')}</div>
                <p className="sr-pillar-desc">{t(locale, 'ov.pillar1.desc')}</p>
              </div>
            </div>
            <div className="sr-pillar">
              <span className="sr-pillar-ico green"><Rocket size={20} /></span>
              <div>
                <div className="sr-pillar-title">
                  {t(locale, 'ov.pillar2.title')} <span className="sr-tag">{t(locale, 'ov.pillar2.tag')}</span>
                </div>
                <p className="sr-pillar-desc">{t(locale, 'ov.pillar2.desc')}</p>
              </div>
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
