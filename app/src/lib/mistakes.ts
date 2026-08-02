import { createServerFn } from '@tanstack/react-start'

import { sql } from '~/lib/db'
import { currentUserId } from '~/lib/session.server'

export type TextbookMistake = {
  id: string
  book: string
  lessonId: string
  exercise: string
  occurredAt: string
}

export type TextbookMistakeSummary = {
  corrected: number
  total: number
}

type Database = ReturnType<typeof sql>

export async function loadTextbookMistakeSummary(
  database: Database,
  userId: number,
): Promise<TextbookMistakeSummary> {
  const [row] = await database`
    select
      count(*)::int as total,
      count(*) filter (
        where exists (
          select 1
          from sr_content_answer_events event
          where event.user_id = mistake.user_id
            and event.lesson_id = mistake.lesson_id
            and event.kind = 'exercise'
            and event.node_id = mistake.exercise_number
            and event.is_correct
            and event.created_at > mistake.occurred_at
        )
      )::int as corrected
    from sr_textbook_mistakes mistake
    where mistake.user_id = ${userId}
  `

  return {
    corrected: Number(row?.corrected ?? 0),
    total: Number(row?.total ?? 0),
  }
}

export const getTextbookMistakeSummary = createServerFn({ method: 'GET' }).handler(
  async (): Promise<TextbookMistakeSummary> => {
    const userId = await currentUserId()
    if (userId == null) return { corrected: 0, total: 0 }
    return loadTextbookMistakeSummary(sql(), userId)
  },
)

export const getTextbookMistakes = createServerFn({ method: 'GET' }).handler(
  async (): Promise<TextbookMistake[]> => {
    const userId = currentUserId()
    if (userId == null) return []

    const rows = await sql()`
      select id::text as id, book_id, lesson_id, exercise_number, occurred_at
      from sr_textbook_mistakes
      where user_id = ${userId}
      order by occurred_at desc, id desc
    `

    return rows.map((row) => ({
      id: row.id,
      book: row.book_id,
      lessonId: row.lesson_id,
      exercise: row.exercise_number,
      occurredAt: new Date(row.occurred_at).toISOString(),
    }))
  },
)
