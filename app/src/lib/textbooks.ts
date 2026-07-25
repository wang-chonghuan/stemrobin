// The curriculum outline shown in the left catalog (STEMROBIN-113).
//
// The outline is the Soviet ten-year school series. Its transcription is a
// repo-level source of truth, not app data: ssot-resources/soviet10year-textbooks/
// toc/<bookId>/<locale>.json. Each locale is a complete file — zh.json is what
// the book prints (extracted from the scan, the authority), en.json is its
// translation — so adding a language adds a file and changes no structure. See
// that directory's README.
//
// The shelf discovers itself: every toc/<bookId>/<locale>.json on disk is picked
// up, so transcribing a new volume is dropping in a directory. Order comes from
// the books' own `subject` and `grade`, not from a list kept in step by hand.
//
// `contents` is the printed table of contents' first level, and not every entry
// there is a chapter — 难题 sits at the same indent as the five chapters. The
// JSON says which is which (`kind`) and this module maps it; the rail renders
// what it is handed rather than knowing about any particular entry.
//
// Depth is 学科 → 册 → 章 → 课. The branch (代数 / 几何 / …) is folded into the
// book's own title ("Algebra, Grade 6") rather than being a fourth level: a
// 236px rail cannot indent four times and still read.
//
// Availability is DB-driven: an outline lesson becomes a link when sr_lessons
// holds its id, and is plain text otherwise.

import { t, type Locale } from '~/lib/i18n'

type SourceRef = { printedSection: number } | { printedName: string }
type RawTopic = { id: string; printedNumber: number; title: string; page: number }
type RawLesson = {
  id: string
  kind: 'section' | 'exercises'
  number: string | null
  title: string
  page: number
  source: SourceRef
  topics?: RawTopic[]
}
type RawEntry =
  | { id: string; kind: 'chapter'; number: number; title: string; page: number; lessons: RawLesson[] }
  | (RawLesson & { kind: 'exercises' })
type RawBook = {
  book: string
  locale: Locale
  subject: string
  grade: number
  title: string
  contents: RawEntry[]
}

export type Discipline = 'math' | 'physics'

// Which discipline each book's subject belongs under, and the order the branches
// run in. The Kolmogorov reform merged the lower grades into plain "mathematics"
// and split algebra/geometry from grade 6 — so these are branches of one
// discipline, not disciplines.
const BRANCH: Record<string, { discipline: Discipline; rank: number }> = {
  early: { discipline: 'math', rank: 0 },
  algebra: { discipline: 'math', rank: 1 },
  analysis: { discipline: 'math', rank: 2 },
  geometry: { discipline: 'math', rank: 3 },
  physics: { discipline: 'physics', rank: 0 },
}

const FILES = import.meta.glob<RawBook>('@ssot/soviet10year-textbooks/toc/*/*.json', {
  eager: true,
  import: 'default',
})

const SHELF: Partial<Record<Locale, RawBook>>[] = (() => {
  const byBook = new Map<string, Partial<Record<Locale, RawBook>>>()
  for (const [path, book] of Object.entries(FILES)) {
    const m = /\/toc\/([^/]+)\/([^/]+)\.json$/.exec(path)
    if (!m) continue
    const entry = byBook.get(m[1]) ?? {}
    entry[m[2] as Locale] = book
    byBook.set(m[1], entry)
  }
  const rank = (b: Partial<Record<Locale, RawBook>>) => {
    const any = b.zh ?? b.en
    return any ? [BRANCH[any.subject]?.rank ?? 9, any.grade] : [9, 99]
  }
  return [...byBook.values()].sort((a, b) => {
    const [ra, ga] = rank(a)
    const [rb, gb] = rank(b)
    return ra - rb || ga - gb
  })
})()

/** `topics` are the book's own numbered teaching items inside a section — the
 *  card boundaries the lesson will be built from. They are shown under the
 *  lesson with the printed numbering, which runs continuously across the whole
 *  volume (1–55 in Algebra 6), so a topic is addressed by its lesson's id plus
 *  that number. They are not pages of their own. */
export type OutlineTopic = { id: string; number: number; title: string }
export type OutlineLesson = {
  id: string
  number: string
  title: string
  ready: boolean
  /** Where the row goes: its first card, or itself when the book gave it no
   *  numbered items and it is therefore one card. */
  cardId: string
  topics: OutlineTopic[]
}
/** A book's contents, mirroring the printed first level: a chapter with sections
 *  beneath it, or an entry that is itself a lesson. */
export type OutlineNode =
  | { kind: 'chapter'; id: string; label: string; lessons: OutlineLesson[] }
  | { kind: 'lesson'; lesson: OutlineLesson }
export type OutlineBook = { book: string; title: string; contents: OutlineNode[] }
export type OutlineDiscipline = { discipline: Discipline; label: string; books: OutlineBook[] }

/** The catalog tree, localized, with availability resolved against the DB ids. */
export function getTextbookOutline(
  lessonIds: readonly string[],
  locale: Locale,
): OutlineDiscipline[] {
  const available = new Set(lessonIds)
  const byDiscipline = new Map<Discipline, OutlineBook[]>()

  for (const localized of SHELF) {
    const book = localized[locale] ?? localized.zh ?? localized.en
    if (!book) continue
    const lesson = (l: RawLesson): OutlineLesson => ({
      id: l.id,
      number: l.number ?? '',
      title: l.title,
      ready: available.has(l.id),
      cardId: l.topics?.length ? l.topics[0].id : l.id,
      topics: (l.topics ?? []).map((tp) => ({
        id: tp.id,
        number: tp.printedNumber,
        title: tp.title,
      })),
    })
    const contents: OutlineNode[] = book.contents.map((e) =>
      e.kind === 'chapter'
        ? {
            kind: 'chapter' as const,
            id: e.id,
            label: t(locale, 'cat.chapter', { n: e.number, title: e.title }),
            lessons: e.lessons.map(lesson),
          }
        : { kind: 'lesson' as const, lesson: lesson(e) },
    )
    const discipline = BRANCH[book.subject]?.discipline ?? 'math'
    const shelf = byDiscipline.get(discipline) ?? []
    shelf.push({ book: book.book, title: book.title, contents })
    byDiscipline.set(discipline, shelf)
  }

  const order: Discipline[] = ['math', 'physics']
  return order.flatMap((d) => {
    const books = byDiscipline.get(d)
    return books?.length ? [{ discipline: d, label: t(locale, `cat.disc.${d}`), books }] : []
  })
}

/** One card, resolved for its own page: where it sits, and its neighbours in
 *  reading order across the whole volume — a card's next is the first card of
 *  the following section once its own runs out. */
export type Card = {
  id: string
  /** The book's own number, where it has one. A section's exercise set and the
   *  volume's closing set are unnumbered. */
  number: number | null
  title: string
  /** The trail down to the card: volume, then whatever levels apply. */
  trail: string[]
  prev: { id: string; title: string } | null
  next: { id: string; title: string } | null
}

type FlatCard = { id: string; number: number | null; title: string; trail: string[] }

/** Every card in a volume, in reading order.
 *
 *  A card is the atom of content, so anything the book gives content to is one:
 *  a section's numbered items are its cards, and an entry the book leaves
 *  unnumbered — a chapter's exercise set, the volume's closing 难题 — is itself
 *  a single card rather than an empty container. That is what keeps every row
 *  of the outline reachable. */
function cardsOf(book: RawBook, locale: Locale): FlatCard[] {
  const chapterLabel = (n: number, title: string) => t(locale, 'cat.chapter', { n, title })
  const sectionLabel = (l: RawLesson) => (l.number ? `${l.number} ${l.title}` : l.title)
  return book.contents.flatMap((e) => {
    if (e.kind !== 'chapter') {
      return [{ id: e.id, number: null, title: e.title, trail: [book.title] }]
    }
    const ch = chapterLabel(e.number, e.title)
    return e.lessons.flatMap((l) =>
      l.topics?.length
        ? l.topics.map((tp) => ({
            id: tp.id,
            number: tp.printedNumber,
            title: tp.title,
            trail: [book.title, ch, sectionLabel(l)],
          }))
        : [{ id: l.id, number: null, title: l.title, trail: [book.title, ch] }],
    )
  })
}

export function findCard(cardId: string, locale: Locale): Card | null {
  for (const localized of SHELF) {
    const book = localized[locale] ?? localized.zh ?? localized.en
    if (!book) continue
    const flat = cardsOf(book, locale)
    const i = flat.findIndex((c) => c.id === cardId)
    if (i < 0) continue
    const ref = (n: number) => (flat[n] ? { id: flat[n].id, title: flat[n].title } : null)
    return { ...flat[i], prev: ref(i - 1), next: ref(i + 1) }
  }
  return null
}

/** Every card id in the whole shelf, in reading order. The deck's denominator —
 *  and, once a card's content is written, the id its row in sr_lessons takes, so
 *  a card's answer events need no table of their own. */
export function allCardIds(): string[] {
  const seen = new Set<string>()
  for (const localized of SHELF) {
    const book = localized.zh ?? localized.en
    if (!book) continue
    for (const c of cardsOf(book, 'zh')) seen.add(c.id)
  }
  return [...seen]
}

/** Every lesson in a book, chapters and top-level entries alike. */
export function bookLessons(book: OutlineBook): OutlineLesson[] {
  return book.contents.flatMap((n) => (n.kind === 'chapter' ? n.lessons : [n.lesson]))
}

/** Outline lessons that have content, in book order — the overview's lesson grid. */
export function getAvailableTextbookLessons(
  lessonIds: readonly string[],
  locale: Locale,
): { id: string; title: string; subject: string }[] {
  return getTextbookOutline(lessonIds, locale).flatMap((d) =>
    d.books.flatMap((b) =>
      bookLessons(b)
        .filter((l) => l.ready)
        .map((l) => ({
          id: l.id,
          title: l.number ? `${l.number} ${l.title}` : l.title,
          subject: b.title,
        })),
    ),
  )
}
