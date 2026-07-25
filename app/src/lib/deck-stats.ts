import { createServerFn } from '@tanstack/react-start'

import { sql } from '~/lib/db'
import { currentUserId } from '~/lib/session.server'
import { allCardIds } from '~/lib/textbooks'

// The three numbers on the home page (STEMROBIN-113), over the card deck rather
// than the retired lesson model that `progress.ts` still computes.
//
// They are three different kinds of number and are not interchangeable:
//   • progress — coverage. Cards touched over cards in the deck. Only ever rises,
//     and its denominator is known from the outline alone.
//   • accuracy — a rate. Correct answers over answers given; it has nothing to do
//     with how much of the deck has been seen, and it can fall.
//   • mastery  — a state. Cards passed over cards in the deck. It can never
//     exceed progress, since an unseen card cannot have been passed.
//
// A card is passed once its check has been answered correctly. Ungraded answers
// (`is_correct is null`, the reasoning items the learner self-checks) are counted
// as neither right nor wrong, so they stay out of accuracy's denominator.
//
// Every count comes from sr_content_answer_events, which keys on a lesson id;
// when a card's content is written its row in sr_lessons takes the card's own id,
// so nothing here needs a new table. Until then the deck has content for no card
// and all three read zero against a real denominator — which is itself worth
// showing, since it says how big the deck is.

export type DeckStats = {
  totalCards: number
  seenCards: number
  passedCards: number
  answered: number
  correct: number
}

export const getDeckStats = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DeckStats> => {
    const cardIds = allCardIds()
    const empty: DeckStats = {
      totalCards: cardIds.length,
      seenCards: 0,
      passedCards: 0,
      answered: 0,
      correct: 0,
    }
    const userId = await currentUserId()
    if (!userId) return empty

    const [row] = await sql()`
      select
        count(distinct lesson_id)                              as seen,
        count(distinct lesson_id) filter (where is_correct)     as passed,
        count(*)  filter (where is_correct is not null)         as answered,
        count(*)  filter (where is_correct)                     as correct
      from sr_content_answer_events
      where user_id = ${userId}
        and lesson_id = any(${cardIds})
    `
    return {
      totalCards: cardIds.length,
      seenCards: Number(row?.seen ?? 0),
      passedCards: Number(row?.passed ?? 0),
      answered: Number(row?.answered ?? 0),
      correct: Number(row?.correct ?? 0),
    }
  },
)

/** The three percentages, rounded, with the zero cases decided rather than NaN. */
export function deckPercentages(s: DeckStats) {
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)
  return {
    progress: pct(s.seenCards, s.totalCards),
    accuracy: pct(s.correct, s.answered),
    mastery: pct(s.passedCards, s.totalCards),
  }
}
