// The curriculum outline shown in the left catalog (STEMROBIN-113).
//
// The outline is the Soviet ten-year school series, one JSON per printed book in
// ~/content/curriculum/. English is canonical; every other locale is an overlay
// keyed by the same ids, so adding a language is adding a file — never editing
// the structure.
//
// Depth is 学科 → 册 → 章 → 课. The branch (代数 / 几何 / …) is folded into the
// book's own title ("Algebra, Grade 6") rather than being a fourth level: a
// 236px rail cannot indent four times and still read, and the branch is legible
// from the title anyway.
//
// A lesson is a printed section; its displayed number (2.3) is derived from its
// position, which the id already encodes. The book's own continuous section
// numbering and its page numbers stay in the JSON for locating the scan.
//
// Availability is DB-driven, exactly as before: an outline lesson becomes a link
// when sr_lessons holds its id, and is plain text otherwise.

import book6a from '~/content/curriculum/6a.json'
import book6aZh from '~/content/curriculum/6a.zh.json'
import { t, type Locale } from '~/lib/i18n'

type RawTopic = { printedNumber: number; title: string; page: number }
type RawLesson = {
  id: string
  kind: 'section' | 'exercises'
  title: string
  page: number
  printedSection?: number
  topics?: RawTopic[]
}
type RawChapter = { id: string; number: number; title: string; page: number; lessons: RawLesson[] }
type RawBook = {
  book: string
  subject: string
  grade: number
  title: string
  chapters: RawChapter[]
  extras: RawLesson[]
}
type Overlay = { title: string; titles: Record<string, string> }

export type Discipline = 'math' | 'physics'

// Which discipline each book's subject belongs under. The Kolmogorov reform
// merged the lower grades into plain "mathematics" and split algebra/geometry
// from grade 6 — so these are branches of one discipline, not disciplines.
const DISCIPLINE_OF: Record<string, Discipline> = {
  early: 'math',
  algebra: 'math',
  analysis: 'math',
  geometry: 'math',
  physics: 'physics',
}

// Shelf order. Only books with a JSON appear; the rest of the series lands here
// as it is transcribed.
const SHELF: { raw: RawBook; overlays: Partial<Record<Locale, Overlay>> }[] = [
  { raw: book6a as RawBook, overlays: { zh: book6aZh as Overlay } },
]

export type OutlineLesson = { id: string; number: string; title: string; ready: boolean }
export type OutlineChapter = { id: string; label: string; lessons: OutlineLesson[] }
/** `extras` belong to the whole volume (the closing 难题 set), so they hang off
 *  the book rather than any one chapter, and carry no chapter number. */
export type OutlineBook = {
  book: string
  title: string
  chapters: OutlineChapter[]
  extras: OutlineLesson[]
}
export type OutlineDiscipline = { discipline: Discipline; label: string; books: OutlineBook[] }

function localize(overlay: Overlay | undefined, id: string, fallback: string): string {
  return overlay?.titles[id] ?? fallback
}

/** The catalog tree, localized, with availability resolved against the DB ids. */
export function getTextbookOutline(
  lessonIds: readonly string[],
  locale: Locale,
): OutlineDiscipline[] {
  const available = new Set(lessonIds)
  const byDiscipline = new Map<Discipline, OutlineBook[]>()

  for (const { raw, overlays } of SHELF) {
    const overlay = overlays[locale]
    const chapters = raw.chapters.map((ch) => ({
      id: ch.id,
      label: t(locale, 'cat.chapter', {
        n: ch.number,
        title: localize(overlay, ch.id, ch.title),
      }),
      lessons: ch.lessons.map((l, i) => ({
        id: l.id,
        number: `${ch.number}.${i + 1}`,
        title: localize(overlay, l.id, l.title),
        ready: available.has(l.id),
      })),
    }))
    const extras = raw.extras.map((l) => ({
      id: l.id,
      number: '',
      title: localize(overlay, l.id, l.title),
      ready: available.has(l.id),
    }))
    const discipline = DISCIPLINE_OF[raw.subject] ?? 'math'
    const shelf = byDiscipline.get(discipline) ?? []
    shelf.push({ book: raw.book, title: overlay?.title ?? raw.title, chapters, extras })
    byDiscipline.set(discipline, shelf)
  }

  const order: Discipline[] = ['math', 'physics']
  return order.flatMap((d) => {
    const books = byDiscipline.get(d)
    return books?.length ? [{ discipline: d, label: t(locale, `cat.disc.${d}`), books }] : []
  })
}

/** Outline lessons that have content, newest last — the overview's lesson grid. */
export function getAvailableTextbookLessons(
  lessonIds: readonly string[],
  locale: Locale,
): { id: string; title: string; subject: string }[] {
  return getTextbookOutline(lessonIds, locale).flatMap((d) =>
    d.books.flatMap((b) =>
      [...b.chapters.flatMap((c) => c.lessons), ...b.extras]
        .filter((l) => l.ready)
        .map((l) => ({
          id: l.id,
          title: l.number ? `${l.number} ${l.title}` : l.title,
          subject: b.title,
        })),
    ),
  )
}
