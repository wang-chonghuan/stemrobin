import { createServerFn } from '@tanstack/react-start'
import { sql } from '~/lib/db'
import { currentUserId } from '~/lib/session.server'
import { normalizeMathAnswer } from '~/lib/answer-normalize'

// Card-quiz data. Questions are delivered WITHOUT the correct option, accepted
// input forms, or worked answer — those are judged/returned only by recordAnswer,
// after the learner answers, so the answer key is never pre-revealed.
export type QuizQuestion = {
  id: number
  ord: number
  type: string
  prompt: string
  answerMode: 'choice' | 'work' | 'input'
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
  isCorrect: boolean | null // null = ungraded (work/说理: self-checked reveal)
  correctIndex: number | null // choice only; null otherwise
  answer: string
}

// Record one answer (requires a logged-in learner). Choice sends `chosen`;
// input sends `text`, judged server-side against the hidden accept list (the
// key never reaches the client). Returns the verdict + the reveal answer.
export const recordAnswer = createServerFn({ method: 'POST' })
  .validator((d: { questionId: number; chosen?: number; text?: string }) => d)
  .handler(
    async ({ data }): Promise<AnswerResult | { error: string }> => {
      const uid = await currentUserId()
      if (uid == null) return { error: '请先登录' }
      const rows = await sql()`
        select correct_index, answer, answer_mode, accept
        from sr_questions where id = ${data.questionId}
      `
      if (!rows.length) return { error: '题目不存在' }
      const mode = rows[0].answer_mode

      if (mode === 'choice') {
        if (typeof data.chosen !== 'number') return { error: '缺少选项' }
        const correctIndex = rows[0].correct_index as number
        const isCorrect = data.chosen === correctIndex
        await sql()`
          insert into sr_answer_events (user_id, question_id, is_correct, chosen)
          values (${uid}, ${data.questionId}, ${isCorrect}, ${data.chosen})
        `
        return { isCorrect, correctIndex, answer: rows[0].answer }
      }

      if (mode === 'input') {
        if (typeof data.text !== 'string' || !data.text.trim()) return { error: '请先输入答案' }
        const accept: string[] = rows[0].accept ?? []
        const typed = normalizeMathAnswer(data.text)
        const isCorrect = accept.some((a) => normalizeMathAnswer(a) === typed)
        await sql()`
          insert into sr_answer_events (user_id, question_id, is_correct, answer_text)
          values (${uid}, ${data.questionId}, ${isCorrect}, ${data.text.trim()})
        `
        return { isCorrect, correctIndex: null, answer: rows[0].answer }
      }

      if (mode === 'work') {
        // 说理/open items: the learner explains aloud first, then reveals the
        // reference answer. We record the attempt (ungraded) and return the
        // reveal — the reference stays server-side until this moment.
        await sql()`
          insert into sr_answer_events (user_id, question_id, is_correct)
          values (${uid}, ${data.questionId}, ${null})
        `
        return { isCorrect: null, correctIndex: null, answer: rows[0].answer }
      }

      return { error: '该题不支持在线作答' }
    },
  )
