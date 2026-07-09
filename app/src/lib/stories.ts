import { createServerFn } from '@tanstack/react-start'
import { marked } from 'marked'

import { sql } from '~/lib/db'
import { currentUserId } from '~/lib/session.server'
import type { QuizQuestion, AnswerResult } from '~/lib/quiz'

// 名人传记 (biography reading) data delivery. A story (creator/book) has ordered
// chapters, each with reading HTML + card-quiz questions, all in the Azure easy-app
// Postgres (sr_stories / sr_story_chapters / sr_story_questions). Served here so DB
// access stays server-side. Mirrors lessons.ts + quiz.ts so the catalog, reader
// iframe, and QuizDrawer are reused rather than duplicated.

export type StoryChapterMeta = {
  id: string
  ord: number
  title: string
  status: 'draft' | 'published'
  stage: string | null
  stageOrd: number | null
  sectionStart: number | null
  sectionEnd: number | null
}
export type StoryCatalogEntry = {
  id: string
  title: string
  person: string
  chapters: StoryChapterMeta[]
}

// Stories + their chapters for the sidebar (DB-driven; NOT hardcoded in
// curriculum.ts — chapters are DB-authored, so the DB is the single source).
export const getStoryCatalog = createServerFn({ method: 'GET' }).handler(
  async (): Promise<StoryCatalogEntry[]> => {
    const stories = await sql()`
      select id, title, person from sr_stories order by title
    `
    const chapters = await sql()`
      select id, story_id, ord, title, status, stage, stage_ord, section_start, section_end
      from sr_story_chapters order by story_id, ord
    `
    return stories.map((s) => ({
      id: s.id,
      title: s.title,
      person: s.person,
      chapters: chapters
        .filter((c) => c.story_id === s.id)
        .map((c) => ({
          id: c.id,
          ord: c.ord,
          title: c.title,
          status: c.status,
          stage: c.stage ?? null,
          stageOrd: c.stage_ord ?? null,
          sectionStart: c.section_start ?? null,
          sectionEnd: c.section_end ?? null,
        })),
    }))
  },
)

// One chapter's pre-rendered print PDF as base64, or null. Mirrors getLessonPdf so
// the story reader can offer a "download PDF" the same way math lessons do.
export const getStoryPdf = createServerFn({ method: 'GET' })
  .validator((chapterId: string) => chapterId)
  .handler(async ({ data: chapterId }): Promise<string | null> => {
    const rows = await sql()`select pdf from sr_story_chapters where id = ${chapterId}`
    if (!rows.length || !rows[0].pdf) return null
    return Buffer.from(rows[0].pdf).toString('base64')
  })

export type ChapterView = { html: string; title: string; storyTitle: string }

// One chapter's reading content + header labels, or null. The chapter body is
// stored as Markdown; it is rendered to HTML here (server-side, trusted content)
// for display in the styled reading container.
export const getChapterView = createServerFn({ method: 'GET' })
  .validator((chapterId: string) => chapterId)
  .handler(async ({ data: chapterId }): Promise<ChapterView | null> => {
    const rows = await sql()`
      select c.md, c.title, s.title as story_title
      from sr_story_chapters c
      join sr_stories s on s.id = c.story_id
      where c.id = ${chapterId}
    `
    if (!rows.length) return null
    const html = rows[0].md ? (marked.parse(rows[0].md, { async: false }) as string) : ''
    return {
      html,
      title: rows[0].title,
      storyTitle: rows[0].story_title,
    }
  })

// Chapter questions WITHOUT the correct option or answer — those are returned only
// by recordStoryAnswer after the learner answers (same answer-key-secrecy rule as
// getLessonQuestions). Reuses the QuizQuestion shape so QuizDrawer is shared.
export const getStoryQuestions = createServerFn({ method: 'GET' })
  .validator((chapterId: string) => chapterId)
  .handler(async ({ data: chapterId }): Promise<QuizQuestion[]> => {
    const rows = await sql()`
      select id, ord, type, prompt, answer_mode, options
      from sr_story_questions where chapter_id = ${chapterId} order by ord
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

// Record one answer for a story question (requires a logged-in learner).
// Choice: correctness computed server-side from sr_story_questions.correct_index.
// Work (口试/品格): ungraded — records the attempt and returns the reference
// answer for self-check. Mirrors recordAnswer.
export const recordStoryAnswer = createServerFn({ method: 'POST' })
  .validator((d: { questionId: number; chosen?: number; text?: string }) => d)
  .handler(async ({ data }): Promise<AnswerResult | { error: string }> => {
    const uid = await currentUserId()
    if (uid == null) return { error: '请先登录' }
    const rows = await sql()`
      select correct_index, answer, answer_mode
      from sr_story_questions where id = ${data.questionId}
    `
    if (!rows.length) return { error: '题目不存在' }
    if (rows[0].answer_mode === 'work') {
      await sql()`
        insert into sr_story_answer_events (user_id, question_id, is_correct)
        values (${uid}, ${data.questionId}, ${null})
      `
      return { isCorrect: null, correctIndex: null, answer: rows[0].answer }
    }
    if (rows[0].answer_mode !== 'choice') return { error: '该题不支持在线作答' }
    if (typeof data.chosen !== 'number') return { error: '缺少选项' }
    const correctIndex = rows[0].correct_index as number
    const isCorrect = data.chosen === correctIndex
    await sql()`
      insert into sr_story_answer_events (user_id, question_id, is_correct, chosen)
      values (${uid}, ${data.questionId}, ${isCorrect}, ${data.chosen})
    `
    return { isCorrect, correctIndex, answer: rows[0].answer }
  })
