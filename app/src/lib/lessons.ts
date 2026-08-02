import { createServerFn } from '@tanstack/react-start'
import { sql } from '~/lib/db'

// Lesson metadata + content delivery. The 課文 and PDF live in the Azure easy-app
// Postgres (`sr_lessons`); the app serves them through these server functions —
// there is no static public/lessons/* path. The DB connection stays server-side.
// One card's readable content: the 課文 blocks and its exercises. Both are stored
// as HTML fragments (KaTeX pre-rendered, figures inline SVG) so the page lays them
// out with the app's own typography instead of hosting a whole document.
export type ProseBlock =
  | { kind: 'p' | 'cap'; html: string }
  | { kind: 'fig'; id: string; label: string | null; svg: string | null }
export type CardFigure = { id: string; label: string | null; svg: string | null }
export type ExerciseAnswerSpec = {
  grading: 'auto' | 'ungraded'
  parts: { label?: string; unit?: string }[]
}
export type CardExercise = {
  number: string
  group: string | null
  html: string
  figureRefs: string[]
  figures: CardFigure[]
  answerSpec?: ExerciseAnswerSpec
}
export type CardContent = { prose: ProseBlock[]; exercises: CardExercise[] }

export const getCardContent = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<CardContent | null> => {
    const rows = await sql()`select content, exercises from sr_lessons where id = ${id}`
    if (!rows.length || !rows[0].content) return null
    const prose = ((rows[0].content as { prose?: ProseBlock[] }).prose ?? []) as ProseBlock[]
    type StoredExercise = CardExercise & {
      answerKey?: {
        grading?: 'auto' | 'ungraded'
        parts?: { label?: string; unit?: string }[]
      }
    }
    const stored =
      (rows[0].exercises as { exercises?: StoredExercise[] } | null)?.exercises ?? []
    const exercises = stored.map((exercise): CardExercise => {
      const answerKey = exercise.answerKey
      const answerSpec =
        answerKey?.grading === 'auto' || answerKey?.grading === 'ungraded'
          ? {
              grading: answerKey.grading,
              parts: Array.isArray(answerKey.parts)
                ? answerKey.parts.map((part) => ({
                    ...(typeof part.label === 'string' ? { label: part.label } : {}),
                    ...(typeof part.unit === 'string' ? { unit: part.unit } : {}),
                  }))
                : [],
            }
          : undefined
      return {
        number: String(exercise.number),
        group: exercise.group ?? null,
        html: exercise.html,
        figureRefs: Array.isArray(exercise.figureRefs)
          ? exercise.figureRefs.filter((id): id is string => typeof id === 'string')
          : [],
        figures: Array.isArray(exercise.figures)
          ? exercise.figures.map((figure) => ({
              id: figure.id,
              label: figure.label ?? null,
              svg: figure.svg ?? null,
            }))
          : [],
        ...(answerSpec ? { answerSpec } : {}),
      }
    })
    return { prose, exercises }
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

// A card is readable when it has 課文 blocks OR numbered exercises. Some printed
// textbook cards (for example 5m lesson 8) start directly with exercises, so an
// empty prose array is valid content rather than an unavailable card.
//
// This replaces the old card-tree model, where availability meant "every prose /
// svg-caption / read-check / exercise node id has an i18n overlay row for this
// locale". That model tied readability to a per-node translation ledger and to
// authored practice items; textbook pages transcribed from a scan have neither,
// so nothing from the scans could ever surface. Content now travels as prose
// blocks + exercises (HTML fragments with KaTeX already rendered and figures as
// inline SVG), which the app lays out itself — see card.$id.tsx.
export const listAvailableLessonIds = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string[]> => {
    const rows = await sql()`
      select id from sr_lessons
      where content is not null
        and (
          jsonb_array_length(coalesce(content->'prose', '[]'::jsonb)) > 0
          or coalesce((exercises->>'count')::int, 0) > 0
        )
      order by id
    `
    return rows.map((r) => r.id)
  },
)
