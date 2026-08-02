import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  MessageCircleQuestion,
  Star,
} from 'lucide-react'

import { useEffect, useRef, useState } from 'react'

import { BrandMark } from '~/components/brand-mark'
import { MathAnswerField } from '~/components/math-answer-field'
import { t, type Locale } from '~/lib/i18n'
import { useLayoutStore } from '~/lib/layout-store'
import { getLocale } from '~/lib/locale'
import { getCardContent, type CardExercise, type ProseBlock } from '~/lib/lessons'
import { findCard } from '~/lib/textbooks'

// One card: a numbered teaching item from the printed book.
//
// The body is what the scan actually says — 課文 blocks and the book's own
// numbered exercises, transcribed by ld-s10y-lesson. Both arrive as HTML fragments
// with the formulas already rendered and the figures inline, so this page
// lays them out with the app's own typography. It deliberately does NOT host a
// self-contained document in an iframe: that made the text a second document
// inside the product (its own fonts, its own measure) and left its height to be
// guessed, which is what pushed the action bar into the middle of the page.
export const Route = createFileRoute('/_app/card/$id')({
  component: CardPage,
  loader: async ({ params }) => {
    const [locale, content] = await Promise.all([
      getLocale(),
      getCardContent({ data: params.id }),
    ])
    return { locale, content, card: findCard(params.id, locale) }
  },
})

function Prose({ blocks }: { blocks: ProseBlock[] }) {
  return (
    <div className="sr-read">
      {blocks.map((b, i) =>
        b.kind === 'fig' ? (
          <figure
            key={i}
            className="sr-read-fig"
            aria-label={b.label ?? undefined}
            {...(!b.image
              ? { dangerouslySetInnerHTML: { __html: b.svg ?? '' } }
              : {})}
          >
            {b.image ? <img src={b.image} alt={b.label ?? ''} /> : null}
          </figure>
        ) : b.kind === 'cap' ? (
          <p key={i} className="sr-read-cap" dangerouslySetInnerHTML={{ __html: b.html }} />
        ) : (
          <p key={i} className="sr-read-p" dangerouslySetInnerHTML={{ __html: b.html }} />
        ),
      )}
    </div>
  )
}

// The book numbers its exercises continuously across a whole volume, so the
// number is the exercise's name — it is shown as given, never re-counted here.
function Exercises({
  items,
  locale,
  cardId,
}: {
  items: CardExercise[]
  locale: Locale
  cardId: string
}) {
  let group: string | null | undefined
  return (
    <div className="sr-ex-list">
      {items.map((e) => {
        const head = e.group !== group ? ((group = e.group), e.group) : null
        return (
          <section key={e.number} className="sr-ex-wrap">
            {head !== null && <h2 className="sr-ex-group">{head || t(locale, 'card.practice')}</h2>}
            <article className="sr-ex" id={`ex-${e.number}`}>
              <div className="sr-ex-n sr-num">{e.number}</div>
              <div className="sr-ex-body">
                <div dangerouslySetInnerHTML={{ __html: e.html }} />
                {e.figures.map((f) => (
                  <figure
                    key={f.id}
                    className="sr-ex-fig"
                    aria-label={f.label ?? undefined}
                    {...(!f.image
                      ? { dangerouslySetInnerHTML: { __html: f.svg ?? '' } }
                      : {})}
                  >
                    {f.image ? <img src={f.image} alt={f.label ?? ''} /> : null}
                  </figure>
                ))}
                <MathAnswerField
                  lessonId={cardId}
                  exercise={e.number}
                  storageKey={`sr_math_answer:${cardId}:${e.number}`}
                  locale={locale}
                  answerSpec={e.answerSpec}
                />
              </div>
            </article>
          </section>
        )
      })}
    </div>
  )
}

function CardPage() {
  const { locale, content, card } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const where = useRef<HTMLElement>(null)
  const [tab, setTab] = useState<'read' | 'ex'>('read')

  // Park the trail at its own end, so a trail too long for the pane shows the
  // section rather than the volume. Re-run once the display font lands.
  const cardId = card?.id
  useEffect(() => {
    const el = where.current
    if (!el) return
    const park = () => {
      el.scrollLeft = el.scrollWidth
    }
    park()
    document.fonts?.ready.then(park).catch(() => {})
  }, [cardId])

  // A new card starts at its 課文 rather than inheriting the previous card's tab.
  useEffect(() => {
    setTab('read')
  }, [cardId])

  const top = (title: string) => (
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
      <span className="sr-d-title">{title}</span>
    </div>
  )

  if (!card) {
    return (
      <main className="sr-detail">
        {top(t(locale, 'deck.missing'))}
        <div className="sr-d-scroll" data-scroll-restoration-id="app-detail">
          <p className="sr-note">{t(locale, 'deck.missing')}</p>
        </div>
      </main>
    )
  }

  const exercises = content?.exercises ?? []
  const prose = content?.prose ?? []

  return (
    <main className="sr-detail">
      {top(card.trail[card.trail.length - 1])}
      <div className="sr-d-scroll" data-scroll-restoration-id="app-detail">
        <article className="sr-deck">
          <nav
            className="sr-deck-where"
            aria-label={t(locale, 'cat.group.curriculum')}
            ref={where}
          >
            {card.trail.map((step, i) => (
              <span key={step} className="sr-deck-step">
                {i > 0 && <span aria-hidden>/</span>}
                {step}
              </span>
            ))}
          </nav>

          <h1 className="sr-deck-title">
            {card.number !== null && <span className="sr-deck-n sr-num">{card.number}</span>}
            {card.title}
          </h1>

          {exercises.length > 0 && (
            <div className="sr-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'read'}
                className={`sr-tab${tab === 'read' ? ' on' : ''}`}
                onClick={() => setTab('read')}
              >
                {t(locale, 'card.read')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'ex'}
                className={`sr-tab${tab === 'ex' ? ' on' : ''}`}
                onClick={() => setTab('ex')}
              >
                {t(locale, 'card.exercises')}
                <span className="sr-tab-n">{exercises.length}</span>
              </button>
            </div>
          )}

          {prose.length === 0 && exercises.length === 0 ? (
            <div className="sr-deck-empty">
              <p className="sr-note">{t(locale, 'deck.empty')}</p>
            </div>
          ) : tab === 'read' ? (
            <Prose blocks={prose} />
          ) : (
            <Exercises items={exercises} locale={locale} cardId={card.id} />
          )}

          <footer className="sr-deck-actions">
            <button type="button" className="sr-deck-act">
              <Star size={15} aria-hidden /> {t(locale, 'deck.fav')}
            </button>
            <button type="button" className="sr-deck-act">
              <MessageCircleQuestion size={15} aria-hidden /> {t(locale, 'deck.askai')}
            </button>
            <span className="sr-deck-spacer" />
            <span className="sr-deck-turn">
              {card.prev ? (
                <Link
                  to="/card/$id"
                  params={{ id: card.prev.id }}
                  className="sr-deck-act"
                  title={card.prev.title}
                >
                  <ChevronLeft size={15} aria-hidden /> {t(locale, 'deck.prev')}
                </Link>
              ) : (
                <span className="sr-deck-act disabled">
                  <ChevronLeft size={15} aria-hidden /> {t(locale, 'deck.prev')}
                </span>
              )}
              {card.next ? (
                <Link
                  to="/card/$id"
                  params={{ id: card.next.id }}
                  className="sr-deck-act"
                  title={card.next.title}
                >
                  {t(locale, 'deck.next')} <ChevronRight size={15} aria-hidden />
                </Link>
              ) : (
                <span className="sr-deck-act disabled">
                  {t(locale, 'deck.next')} <ChevronRight size={15} aria-hidden />
                </span>
              )}
            </span>
          </footer>
        </article>
      </div>
    </main>
  )
}
