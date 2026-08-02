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
