import { createServerFn } from '@tanstack/react-start'
import { sql } from '~/lib/db'
import { currentLocale } from '~/lib/locale.server'

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

// Pure per-locale availability rule (DB-free, unit-tested). A lesson is available
// in a locale iff that locale's overlay covers EVERY translatable node id the
// lesson references (its prose/caption/read-check/exercise nodes). This is the
// clean D5 rule — a lesson never renders half-translated. zh (source) covers all
// its own nodes, so it is always available; a partially-translated en is not.
export function lessonAvailableInLocale(
  referencedNodeIds: readonly string[],
  overlayKeys: ReadonlySet<string>,
): boolean {
  return referencedNodeIds.every((id) => overlayKeys.has(id))
}

// Ids of lessons READABLE in the learner's current locale (from the sr_locale
// cookie). A lesson qualifies only when its (lesson, locale) overlay covers every
// translatable node id referenced by its content + exercises — no mixed-language
// fallback. Drives the catalog + overview + lesson nav so untranslated lessons do
// not appear as readable items in a locale they are not fully translated for.
export const listAvailableLessonIds = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string[]> => {
    const locale = currentLocale()
    const rows = await sql()`
      with nodes as (
        select l.id lesson_id, b->>'id' node_id
          from sr_lessons l,
               jsonb_array_elements(l.content->'cards') c,
               jsonb_array_elements(c->'body') b
          where b->>'kind' = 'prose'
        union
        select l.id, b->>'caption_id'
          from sr_lessons l,
               jsonb_array_elements(l.content->'cards') c,
               jsonb_array_elements(c->'body') b
          where b->>'kind' = 'svg' and b ? 'caption_id'
        union
        select l.id, rc->>'id'
          from sr_lessons l,
               jsonb_array_elements(l.content->'cards') c,
               jsonb_array_elements(coalesce(c->'read_check','[]'::jsonb)) rc
        union
        select l.id, opt
          from sr_lessons l,
               jsonb_array_elements(l.content->'cards') c,
               jsonb_array_elements(coalesce(c->'read_check','[]'::jsonb)) rc,
               jsonb_array_elements_text(coalesce(rc->'options','[]'::jsonb)) opt
        union
        select l.id, i->>'id'
          from sr_lessons l,
               jsonb_array_elements(l.exercises->'items') i
        union
        select l.id, opt
          from sr_lessons l,
               jsonb_array_elements(l.exercises->'items') i,
               jsonb_array_elements_text(coalesce(i->'options','[]'::jsonb)) opt
      )
      select n.lesson_id
        from nodes n
        left join sr_lesson_i18n ov
          on ov.lesson_id = n.lesson_id and ov.locale = ${locale}
        where n.node_id is not null
        group by n.lesson_id
        having count(*) filter (
          where ov.overlay is null or not (ov.overlay ? n.node_id)
        ) = 0
        order by n.lesson_id
    `
    return rows.map((r) => r.lesson_id)
  },
)
