import { createServerFn } from '@tanstack/react-start'
import { sql } from '~/lib/db'

// Lesson metadata + content delivery. The 課文 and PDF live in the Azure easy-app
// Postgres (`sr_lessons`); the app serves them through these server functions —
// there is no static public/lessons/* path. The DB connection stays server-side.
export type LessonMeta = {
  id: string
  subject: 'math' | 'physics'
  stage: number
  order: number
  title: string
  concept: string
  status: 'draft' | 'published'
}

// One lesson's metadata by id, or null if absent.
export const getLesson = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<LessonMeta | null> => {
    const rows = await sql()`
      select id, subject, stage, lesson_order, title, concept, status
      from sr_lessons where id = ${id}
    `
    if (!rows.length) return null
    const r = rows[0]
    return {
      id: r.id,
      subject: r.subject,
      stage: r.stage,
      order: r.lesson_order,
      title: r.title,
      concept: r.concept,
      status: r.status,
    }
  })

// The 課文 HTML for a lesson, injected into the iframe via srcdoc.
export const getLessonHtml = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<string | null> => {
    const rows = await sql()`select html from sr_lessons where id = ${id}`
    return rows.length ? (rows[0].html ?? null) : null
  })

// The lesson PDF as base64 (the client turns it into a Blob download). Kept as
// a server fn so the DB access and bytes stay server-side.
export const getLessonPdf = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<string | null> => {
    const rows = await sql()`select pdf from sr_lessons where id = ${id}`
    if (!rows.length || !rows[0].pdf) return null
    return Buffer.from(rows[0].pdf).toString('base64')
  })

// Ids of lessons that exist in the DB (used to mark catalog availability).
export const listLessonIds = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string[]> => {
    const rows = await sql()`select id from sr_lessons order by id`
    return rows.map((r) => r.id)
  },
)

// A lesson is readable when it has 課文 html. That is the whole rule.
//
// This replaces the old card-tree model, where availability meant "every prose /
// svg-caption / read-check / exercise node id has an i18n overlay row for this
// locale". That model tied readability to a per-node translation ledger and to
// authored practice items; textbook pages transcribed from a scan have neither,
// so nothing from the scans could ever surface. Content now travels as one
// rendered document per lesson — the same artifact the renderer produces — and
// the catalog links whatever has one.
export const listAvailableLessonIds = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string[]> => {
    const rows = await sql()`
      select id from sr_lessons
      where html is not null and length(html) > 0
      order by id
    `
    return rows.map((r) => r.id)
  },
)
