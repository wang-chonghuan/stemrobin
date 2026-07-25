// The curriculum outline shown in the left catalog (STEMROBIN-113).
//
// The outline is the Soviet ten-year school series. Its transcription is a
// repo-level source of truth, not app data: ssot-resources/soviet10year-textbooks/
// toc/<bookId>/<locale>.json, imported through the @ssot alias. Each locale is a
// complete file — zh.json is what the book prints (extracted from the scan, the
// authority), en.json is its translation — so adding a language adds a file and
// changes no structure. See that directory's README.
//
// Depth is 学科 → 册 → 章 → 课. The branch (代数 / 几何 / …) is folded into the
// book's own title ("Algebra, Grade 6") rather than being a fourth level: a
// 236px rail cannot indent four times and still read, and the branch is legible
// from the title anyway.
//
// A lesson's displayed number (2.3) is authored in the JSON, next to the
// `source` ref that identifies the same entry in the printed contents. Neither
// the source ref nor the page number is displayed; both exist to get back to the
// scan.
//
// Availability is DB-driven, exactly as before: an outline lesson becomes a link
// when sr_lessons holds its id, and is plain text otherwise.

import alg6En from '@ssot/soviet10year-textbooks/toc/6a/en.json'
import alg6Zh from '@ssot/soviet10year-textbooks/toc/6a/zh.json'
import { t, type Locale } from '~/lib/i18n'

type SourceRef = { printedSection: number } | { printedName: string }
type RawTopic = { printedNumber: number; title: string; page: number }
type RawLesson = {
  id: string
  kind: 'section' | 'exercises'
  number: string | null
  title: string
  page: number
  source: SourceRef
  topics?: RawTopic[]
}
type RawChapter = { id: string; number: number; title: string; page: number; lessons: RawLesson[] }
type RawBook = {
  book: string
  locale: Locale
  subject: string
  grade: number
  title: string
  chapters: RawChapter[]
  extras: RawLesson[]
}

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

// Shelf order. One entry per printed volume, carrying every locale of it; the
// rest of the series lands here as it is transcribed.
const SHELF: Record<Locale, RawBook>[] = [
  { zh: alg6Zh as RawBook, en: alg6En as RawBook },
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

/** The catalog tree, localized, with availability resolved against the DB ids. */
export function getTextbookOutline(
  lessonIds: readonly string[],
  locale: Locale,
): OutlineDiscipline[] {
  const available = new Set(lessonIds)
  const byDiscipline = new Map<Discipline, OutlineBook[]>()

  for (const localized of SHELF) {
    const book = localized[locale] ?? localized.zh
    const lesson = (l: RawLesson): OutlineLesson => ({
      id: l.id,
      number: l.number ?? '',
      title: l.title,
      ready: available.has(l.id),
    })
    const chapters = book.chapters.map((ch) => ({
      id: ch.id,
      label: t(locale, 'cat.chapter', { n: ch.number, title: ch.title }),
      lessons: ch.lessons.map(lesson),
    }))
    const discipline = DISCIPLINE_OF[book.subject] ?? 'math'
    const shelf = byDiscipline.get(discipline) ?? []
    shelf.push({
      book: book.book,
      title: book.title,
      chapters,
      extras: book.extras.map(lesson),
    })
    byDiscipline.set(discipline, shelf)
  }

  const order: Discipline[] = ['math', 'physics']
  return order.flatMap((d) => {
    const books = byDiscipline.get(d)
    return books?.length ? [{ discipline: d, label: t(locale, `cat.disc.${d}`), books }] : []
  })
}

/** Outline lessons that have content, in book order — the overview's lesson grid. */
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
