import { createServerFn } from '@tanstack/react-start'
import { sql } from '~/lib/db'
import { currentUserId } from '~/lib/session.server'

// Card-quiz data. Questions are delivered WITHOUT the correct option or worked
// answer — those are returned only by recordAnswer, after the learner answers,
// so the answer is never pre-revealed (consistent with the answers-hidden rule;
// the quiz's post-answer reveal is the one deliberate in-app exception).
export type QuizQuestion = {
  id: number
  ord: number
  type: string
  prompt: string
  answerMode: 'choice' | 'work'
  options: string[] | null
}

export const getLessonQuestions = createServerFn({ method: 'GET' })
  .validator((lessonId: string) => lessonId)
  .handler(async ({ data: lessonId }): Promise<QuizQuestion[]> => {
    const rows = await sql()`
      select id, ord, type, prompt, answer_mode, options
      from sr_questions where lesson_id = ${lessonId} order by ord
    `
    return rows.map((r) => ({
      id: r.id,
      ord: r.ord,
      type: r.type,
      prompt: r.prompt,
      answerMode: r.answer_mode,
      options: r.options ?? null,
    }))
  })

export type AnswerResult = {
  isCorrect: boolean
  correctIndex: number
  answer: string
}

// Record one choice answer (requires a logged-in learner). Returns the verdict +
// the correct option + the worked answer for the post-answer reveal.
export const recordAnswer = createServerFn({ method: 'POST' })
  .validator((d: { questionId: number; chosen: number }) => d)
  .handler(
    async ({ data }): Promise<AnswerResult | { error: string }> => {
      const uid = await currentUserId()
      if (uid == null) return { error: '请先登录' }
      const rows = await sql()`
        select correct_index, answer, answer_mode
        from sr_questions where id = ${data.questionId}
      `
      if (!rows.length) return { error: '题目不存在' }
      if (rows[0].answer_mode !== 'choice') return { error: '该题不是选择题' }
      const correctIndex = rows[0].correct_index as number
      const isCorrect = data.chosen === correctIndex
      await sql()`
        insert into sr_answer_events (user_id, question_id, is_correct, chosen)
        values (${uid}, ${data.questionId}, ${isCorrect}, ${data.chosen})
      `
      return { isCorrect, correctIndex, answer: rows[0].answer }
    },
  )
