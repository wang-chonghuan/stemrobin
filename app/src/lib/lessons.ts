import { createServerFn } from '@tanstack/react-start'
import { sql } from '~/lib/db'

// Lesson metadata + content delivery. The 課文 and PDF live in the Azure easy-app
// Postgres (`sr_lessons`); the app serves them through these server functions —
// there is no static public/lessons/* path. The DB connection stays server-side.
// One card's readable content: the 課文 blocks and its exercises. Both are stored
// as HTML fragments (KaTeX pre-rendered, figures inline) so the page lays them
// out with the app's own typography instead of hosting a whole document.
export type ProseBlock =
  | { kind: 'p' | 'cap'; html: string }
  | {
      kind: 'fig'
      id: string
      label: string | null
      image?: string | null
      svg?: string | null
    }
export type CardFigure = {
  id: string
  label: string | null
  image?: string | null
  svg?: string | null
}
// What the browser is allowed to know about one blank: how to label it, what
// unit it is measured in, and which kind of input it takes. Never the expected
// value — that stays server-side (see textbook-answer.ts).
export type PartInputKind = 'number' | 'math'
export type ExerciseAnswerSpec = {
  grading: 'auto' | 'ungraded'
  parts: { label?: string; unit?: string; input: PartInputKind }[]
}
// A coordinate exercise answered by clicking cells instead of typing pairs of
// numbers. Deliberately carries NO coordinates: the grid the learner draws on,
// the names of the points to place, and which blank each click feeds — nothing
// that would give the answer away. Grading stays server-side and unchanged,
// because a click still lands in the same numeric blanks.
export type ExerciseGridSpec = {
  kind: 'grid-point' | 'grid-plot'
  domain: { x: [number, number]; y: [number, number] }
  points: string[]
  parts: { point: string; axis: 'x' | 'y' }[]
}
export type CardExercise = {
  number: string
  group: string | null
  html: string
  figureRefs: string[]
  figures: CardFigure[]
  answerSpec?: ExerciseAnswerSpec
  grid?: ExerciseGridSpec
}
export type CardContent = { prose: ProseBlock[]; exercises: CardExercise[] }

export const getCardContent = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<CardContent | null> => {
    const rows = await sql()`select content, exercises from sr_lessons where id = ${id}`
    if (!rows.length || !rows[0].content) return null
    const prose = ((rows[0].content as { prose?: ProseBlock[] }).prose ?? []) as ProseBlock[]
    // The stored key's part label went out under two different names: the
    // documented `label` (ld-s10y-answer/lesson-answers@1) and an older `id`
    // that predates it. Both mean the same thing, so both are read; writing one
    // canonical name back into the corpus is the answer skill's job, not this
    // projection's.
    type StoredPart = {
      label?: string
      id?: string
      unit?: string
      judge?: 'exact' | 'numeric' | 'expression'
    }
    type StoredInteraction = {
      widget?: string
      frame?: { domain?: { x?: number[]; y?: number[] } }
      points?: Record<string, number[]>
      parts?: { point?: string; axis?: string }[]
    }
    type StoredExercise = CardExercise & {
      answerKey?: {
        grading?: 'auto' | 'ungraded'
        parts?: StoredPart[]
      }
      interaction?: StoredInteraction
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
                ? answerKey.parts.map((part) => {
                    const label =
                      typeof part.label === 'string'
                        ? part.label
                        : typeof part.id === 'string'
                          ? part.id
                          : undefined
                    return {
                      ...(label ? { label } : {}),
                      ...(typeof part.unit === 'string' ? { unit: part.unit } : {}),
                      // A blank whose answer is a plain number needs a number
                      // pad, not a formula editor. Everything else keeps the
                      // math field, which is the only thing that can express it.
                      input: (part.judge === 'numeric' ? 'number' : 'math') as PartInputKind,
                    }
                  })
                : [],
            }
          : undefined
      const interaction = exercise.interaction
      const domain = interaction?.frame?.domain
      const gridParts = interaction?.parts
      const grid: ExerciseGridSpec | undefined =
        (interaction?.widget === 'grid-point' || interaction?.widget === 'grid-plot') &&
        domain?.x?.length === 2 &&
        domain?.y?.length === 2 &&
        Array.isArray(gridParts) &&
        gridParts.length > 0
          ? {
              kind: interaction.widget,
              domain: {
                x: [domain.x[0], domain.x[1]],
                y: [domain.y[0], domain.y[1]],
              },
              // Point order comes from the parts list, not from the coordinate
              // map — the map is the answer and never leaves the server.
              points: gridParts
                .map((part) => part.point)
                .filter((name, index, all): name is string =>
                  typeof name === 'string' && all.indexOf(name) === index,
                ),
              parts: gridParts.flatMap((part) =>
                typeof part.point === 'string' && (part.axis === 'x' || part.axis === 'y')
                  ? [{ point: part.point, axis: part.axis }]
                  : [],
              ),
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
              image: figure.image ?? null,
              svg: figure.svg ?? null,
            }))
          : [],
        ...(answerSpec ? { answerSpec } : {}),
        ...(grid ? { grid } : {}),
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
// blocks + exercises (HTML fragments with KaTeX already rendered and inline
// figures), which the app lays out itself — see card.$id.tsx.
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
