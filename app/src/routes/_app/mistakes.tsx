import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowRight, BookOpenCheck, Menu } from 'lucide-react'

import { BrandMark } from '~/components/brand-mark'
import { t, type Locale } from '~/lib/i18n'
import { useLayoutStore } from '~/lib/layout-store'
import { getLocale } from '~/lib/locale'
import { getTextbookMistakes, type TextbookMistake } from '~/lib/mistakes'
import { getCurrentUser } from '~/lib/session'

export const Route = createFileRoute('/_app/mistakes')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
  },
  component: MistakesPage,
  loader: async () => ({
    locale: await getLocale(),
    mistakes: await getTextbookMistakes(),
  }),
})

function utcTime(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`
}

function groupByUtcDate(mistakes: TextbookMistake[]) {
  const groups = new Map<string, TextbookMistake[]>()
  for (const mistake of mistakes) {
    const date = mistake.occurredAt.slice(0, 10)
    const items = groups.get(date) ?? []
    items.push(mistake)
    groups.set(date, items)
  }
  return [...groups]
}

function MistakeRow({ mistake, locale }: { mistake: TextbookMistake; locale: Locale }) {
  return (
    <article
      className="sr-mistake-row"
      data-mistake-id={mistake.id}
      data-mistake-book={mistake.book}
      data-mistake-exercise={mistake.exercise}
    >
      <div className="sr-mistake-main">
        <div className="sr-mistake-ref">
          <span>{t(locale, 'mistakes.book', { book: mistake.book })}</span>
          <strong>{t(locale, 'mistakes.exercise', { exercise: mistake.exercise })}</strong>
        </div>
        <time dateTime={mistake.occurredAt}>{utcTime(mistake.occurredAt)}</time>
      </div>
      <Link
        to="/card/$id"
        params={{ id: mistake.lessonId }}
        search={{ tab: 'ex', exercise: Number(mistake.exercise) }}
        className="sr-mistake-redo"
      >
        {t(locale, 'mistakes.redo')}
        <ArrowRight size={15} aria-hidden />
      </Link>
    </article>
  )
}

function MistakesPage() {
  const { locale, mistakes } = Route.useLoaderData()
  const setDrawer = useLayoutStore((state) => state.setDrawer)
  const groups = groupByUtcDate(mistakes)

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
        <BrandMark className="sr-title-logo" size={22} decorative />
        <span className="sr-d-title">{t(locale, 'mistakes.title')}</span>
      </div>

      <div className="sr-d-scroll" data-scroll-restoration-id="app-detail">
        <section className="sr-mistakes">
          <header className="sr-mistakes-head">
            <h1>{t(locale, 'mistakes.title')}</h1>
            <BookOpenCheck size={22} aria-hidden />
          </header>
          <div className="sr-tabs sr-mistake-tabs" role="tablist">
            <button
              type="button"
              className="sr-tab on"
              role="tab"
              aria-selected="true"
            >
              <BookOpenCheck size={15} aria-hidden />
              {t(locale, 'mistakes.view.date')}
            </button>
          </div>

          {groups.length === 0 ? (
            <div className="sr-empty">
              <div className="sr-empty-icon">
                <BookOpenCheck size={21} aria-hidden />
              </div>
              <h3>{t(locale, 'mistakes.title')}</h3>
              <p>{t(locale, 'mistakes.empty')}</p>
            </div>
          ) : (
            <div className="sr-mistake-groups">
              {groups.map(([date, items]) => (
                <section key={date} className="sr-mistake-group" data-mistake-date={date}>
                  <h2>{date} UTC</h2>
                  <div>
                    {items.map((mistake) => (
                      <MistakeRow key={mistake.id} mistake={mistake} locale={locale} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
