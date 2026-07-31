import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Menu,
  MessageCircleQuestion,
  Star,
} from 'lucide-react'

import { useEffect, useRef } from 'react'

import { LessonFrame } from '~/components/lesson-frame'
import { getLessonHtml } from '~/lib/lessons'
import { t } from '~/lib/i18n'
import { useLayoutStore } from '~/lib/layout-store'
import { getLocale } from '~/lib/locale'
import { findCard } from '~/lib/textbooks'

// One card: a numbered teaching item from the printed book.
//
// The body is the 課文 transcribed from the scan — one self-contained document
// (KaTeX pre-rendered, figures inlined as SVG) written by ld-page2class and
// stored under the card's own id, which is why no new table was needed. A card
// with nothing stored yet still has an address and a shape; it just says so.
export const Route = createFileRoute('/_app/card/$id')({
  component: CardPage,
  loader: async ({ params }) => {
    const [locale, html] = await Promise.all([
      getLocale(),
      getLessonHtml({ data: params.id }),
    ])
    return { locale, html, card: findCard(params.id, locale) }
  },
})

function CardPage() {
  const { locale, html, card } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const where = useRef<HTMLElement>(null)

  // Park the trail at its own end, so a trail too long for the pane shows the
  // section rather than the volume. Re-run once the display font lands: with the
  // fallback metrics the trail can still fit, and it is the webfont that makes it
  // overflow.
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

  // The drawer toggle lives in this bar, so it has to be here too — below the
  // shared breakpoint it is the only way back to the catalog.
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
      <Layers size={18} color="var(--sr-blue)" />
      <span className="sr-d-title">{title}</span>
    </div>
  )

  if (!card) {
    return (
      <main className="sr-detail">
        {top(t(locale, 'deck.missing'))}
        <div className="sr-d-scroll">
          <p className="sr-note">{t(locale, 'deck.missing')}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="sr-detail">
      {top(card.trail[card.trail.length - 1])}
      <div className="sr-d-scroll sr-d-scroll-fill">
        <article className="sr-deck">
          {/* Where this card sits, in the book's own words. It scrolls rather
              than wraps or truncates, and starts at its own end: the section is
              what tells you where you are, the volume you already know. */}
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
            {/* Only where the book numbers it — a chapter's exercise set and the
                volume's closing set carry no number of their own. */}
            {card.number !== null && <span className="sr-deck-n sr-num">{card.number}</span>}
            {card.title}
          </h1>
          <p className="sr-deck-id sr-num">{card.id}</p>

          <div className="sr-deck-body">
            {html ? (
              <LessonFrame html={html} title={card.title} />
            ) : (
              <p className="sr-note">{t(locale, 'deck.empty')}</p>
            )}
          </div>

          <footer className="sr-deck-actions">
            <button type="button" className="sr-deck-act">
              <Star size={15} aria-hidden /> {t(locale, 'deck.fav')}
            </button>
            <button type="button" className="sr-deck-act">
              <MessageCircleQuestion size={15} aria-hidden /> {t(locale, 'deck.askai')}
            </button>
            <span className="sr-deck-spacer" />
            {/* Kept in one group so a narrow pane wraps them together rather
                than stranding Next on its own line. */}
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
