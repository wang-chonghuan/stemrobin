import { createServerFn } from '@tanstack/react-start'
import { sql } from '~/lib/db'
import { currentUserId } from '~/lib/session.server'
import { currentLocale } from '~/lib/locale.server'
import { localizeQuestionType } from '~/lib/i18n'
import { normalizeMathAnswer } from '~/lib/answer-normalize'
import { recordPracticeAttempt } from '~/lib/progress'

// Neutral exercise-deck shapes (subset read for the non-source-locale practice
// deck). The deck's prose (prompt/options) lives in the per-locale overlay keyed
// by node id; the KEY (correct_index/accept) stays in the neutral base and is
// NEVER projected here. items align 1:1 with sr_questions by `ord` (same option
// order + correct_index), so the numeric sr_questions.id + the existing judge and
// attempt machinery serve every locale unchanged — only the TEXT comes from the
// overlay.
type ExItem = { id: string; ord: number; mode: string; options?: string[] }
type Exercises = { items: ExItem[] }
type Overlay = Record<string, { t: string; src_rev: number }>

// The post-answer reveal explanation exists only in the source locale (zh) —
// there is no translated explanation node — so a translation locale gets an empty
// reveal (verdict + correct-option highlight is the feedback), never half-Chinese.
export function localeReveal(locale: 'zh' | 'en', answer: string): string {
  return locale === 'zh' ? answer : ''
}

// Project a lesson's practice deck into the learner's locale. Source locale (zh)
// keeps the relational sr_questions text verbatim; a translation locale (en)
// sources prompt/option TEXT from the exercises JSONB + that locale's overlay,
// keyed to each sr_questions row by ord. KEY-free by construction.
export function projectQuestions(
  rows: readonly {
    id: number
    ord: number
    type: string
    prompt: string
    answer_mode: 'choice' | 'work' | 'input'
    options: string[] | null
  }[],
  exercises: Exercises | null,
  overlay: Overlay,
  locale: 'zh' | 'en',
): QuizQuestion[] {
  const base = rows.map((r) => ({
    id: r.id,
    ord: r.ord,
    type: r.type,
    prompt: r.prompt,
    answerMode: r.answer_mode,
    options: r.options ?? null,
  }))
  if (locale === 'zh' || !exercises || !Array.isArray(exercises.items)) return base
  const itemByOrd = new Map(exercises.items.map((i) => [i.ord, i]))
  return base.map((q) => {
    const item = itemByOrd.get(q.ord)
    const prompt = item && overlay[item.id]?.t ? overlay[item.id].t : q.prompt
    const options =
      item && q.answerMode === 'choice'
        ? (item.options ?? []).map((oid) => overlay[oid]?.t ?? '')
        : q.options
    return { ...q, type: localizeQuestionType(q.type, locale), prompt, options }
  })
}

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
    const locale = currentLocale()
    const rows = await sql()`
      select id, ord, type, prompt, answer_mode, options
      from sr_questions where lesson_id = ${lessonId} order by ord
    `
    if (locale === 'zh') {
      return projectQuestions(rows as never, null, {}, 'zh')
    }
    // Non-source locale: pull the translated deck text from the neutral exercises
    // JSONB + this locale's overlay (KEY stays in the neutral base, never selected).
    const ex = await sql()`
      select l.exercises, ov.overlay
      from sr_lessons l
      left join sr_lesson_i18n ov on ov.lesson_id = l.id and ov.locale = ${locale}
      where l.id = ${lessonId}
    `
    const exercises = ex.length ? (ex[0].exercises as Exercises | null) : null
    const overlay = (ex.length ? (ex[0].overlay as Overlay | null) : null) ?? {}
    return projectQuestions(rows as never, exercises, overlay, locale)
  })

export type AnswerResult = {
  isCorrect: boolean | null // null = ungraded (work/说理: self-checked reveal)
  correctIndex: number | null // choice only; null otherwise
  answer: string
}

// Record one answer (requires a logged-in learner). Choice sends `chosen`;
// input sends `text`, judged server-side against the hidden accept list (the
// key never reaches the client). `attemptId` groups the event into a 答题 pass
// (optional). Returns the verdict + the reveal answer.
export const recordAnswer = createServerFn({ method: 'POST' })
  .validator(
    (d: { questionId: number; attemptId?: number; chosen?: number; text?: string }) => d,
  )
  .handler(
    async ({ data }): Promise<AnswerResult | { error: string }> => {
      const uid = currentUserId()
      if (uid == null) return { error: '请先登录' }
      const locale = currentLocale()
      const attemptId = data.attemptId ?? null
      const rows = await sql()`
        select correct_index, answer, answer_mode, accept
        from sr_questions where id = ${data.questionId}
      `
      if (!rows.length) return { error: '题目不存在' }
      const mode = rows[0].answer_mode
      // Suppress the zh reference explanation outside the source locale (see
      // localeReveal) so the reveal is never half-Chinese. Judging is unchanged.
      const reveal = (a: string): string => localeReveal(locale, a)

      if (mode === 'choice') {
        if (typeof data.chosen !== 'number') return { error: '缺少选项' }
        const correctIndex = rows[0].correct_index as number
        const isCorrect = data.chosen === correctIndex
        await sql()`
          insert into sr_answer_events (user_id, question_id, attempt_id, is_correct, chosen)
          values (${uid}, ${data.questionId}, ${attemptId}, ${isCorrect}, ${data.chosen})
        `
        return { isCorrect, correctIndex, answer: reveal(rows[0].answer) }
      }

      if (mode === 'input') {
        if (typeof data.text !== 'string' || !data.text.trim()) return { error: '请先输入答案' }
        const accept: string[] = rows[0].accept ?? []
        const typed = normalizeMathAnswer(data.text)
        const isCorrect = accept.some((a) => normalizeMathAnswer(a) === typed)
        await sql()`
          insert into sr_answer_events (user_id, question_id, attempt_id, is_correct, answer_text)
          values (${uid}, ${data.questionId}, ${attemptId}, ${isCorrect}, ${data.text.trim()})
        `
        return { isCorrect, correctIndex: null, answer: reveal(rows[0].answer) }
      }

      if (mode === 'work') {
        // 说理/open items: the learner explains aloud first, then reveals the
        // reference answer. We record the attempt (ungraded) and return the
        // reveal — the reference stays server-side until this moment.
        await sql()`
          insert into sr_answer_events (user_id, question_id, attempt_id, is_correct)
          values (${uid}, ${data.questionId}, ${attemptId}, ${null})
        `
        return { isCorrect: null, correctIndex: null, answer: reveal(rows[0].answer) }
      }

      return { error: '该题不支持在线作答' }
    },
  )

// ── 答题记录 (attempts) ──────────────────────────────────────────────────────
// A 答题 is one pass through a lesson's deck. Scoring counts only gradable items
// (choice + input); 说理/work items are self-checked and excluded from the ratio,
// reported separately. Unanswered gradable items stay in the denominator (they
// lower the percentage), so ending early honestly reflects completion.

export type ScoreSummary = {
  correct: number // gradable items answered correctly
  gradableTotal: number // denominator N = count of choice+input items in the lesson
  unanswered: number // gradable items not yet answered when the attempt ended
  wrongOrds: number[] // ords of gradable items answered incorrectly (ascending)
  workDone: number // 说理 items completed (excluded from the ratio)
  workTotal: number // total 说理 items in the lesson
  endedAt: string // ISO timestamp the attempt was ended
}

// One answered item, enough to re-hydrate the drawer card on 继续上一次.
export type AnsweredItem = {
  questionId: number
  ord: number
  isCorrect: boolean | null
  chosen: number | null // choice: original option index picked
  typed: string | null // input: text typed
  correctIndex: number | null // choice: correct option index (already revealed once answered)
  answer: string // reveal explanation
}

export type OpenAttempt = { attemptId: number; answered: AnsweredItem[] }

// The single definition of an attempt's score percent (STEMROBIN-30). Gradable
// items only (choice+input); an all-说理 deck has no gradable total → 0. This is
// both what the learner sees (ScoreCard) and what is recorded into the progress
// model at attempt end, so the two can never diverge.
export function attemptScorePercent(correct: number, gradableTotal: number): number {
  return gradableTotal > 0 ? Math.round((correct / gradableTotal) * 100) : 0
}

// Summarize one attempt against its lesson's deck. Server-only helper.
async function summarizeAttempt(
  lessonId: string,
  attemptId: number,
  endedAt: Date | string,
): Promise<ScoreSummary> {
  const questions = await sql()`
    select id, ord, answer_mode from sr_questions where lesson_id = ${lessonId}
  `
  const events = await sql()`
    select question_id, is_correct from sr_answer_events where attempt_id = ${attemptId}
  `
  const verdictByQ = new Map<number, boolean | null>()
  for (const e of events) verdictByQ.set(Number(e.question_id), e.is_correct)

  let gradableTotal = 0
  let workTotal = 0
  let correct = 0
  let answeredGradable = 0
  let workDone = 0
  const wrongOrds: number[] = []
  for (const row of questions) {
    if (row.answer_mode === 'work') {
      workTotal++
      if (verdictByQ.has(Number(row.id))) workDone++
      continue
    }
    gradableTotal++
    if (!verdictByQ.has(Number(row.id))) continue // unanswered gradable
    answeredGradable++
    if (verdictByQ.get(Number(row.id)) === true) correct++
    else wrongOrds.push(row.ord)
  }
  wrongOrds.sort((a, b) => a - b)
  return {
    correct,
    gradableTotal,
    unanswered: gradableTotal - answeredGradable,
    wrongOrds,
    workDone,
    workTotal,
    endedAt: (endedAt instanceof Date ? endedAt : new Date(endedAt)).toISOString(),
  }
}

// Latest ENDED attempt's scorecard for this learner+lesson (null if none / logged out).
export const getLatestScore = createServerFn({ method: 'GET' })
  .validator((lessonId: string) => lessonId)
  .handler(async ({ data: lessonId }): Promise<ScoreSummary | null> => {
    const uid = currentUserId()
    if (uid == null) return null
    const att = await sql()`
      select id, ended_at from sr_quiz_attempts
      where user_id = ${uid} and lesson_id = ${lessonId} and ended_at is not null
      order by ended_at desc limit 1
    `
    if (!att.length) return null
    return summarizeAttempt(lessonId, Number(att[0].id), att[0].ended_at)
  })

// The learner's still-open attempt for this lesson, with its answered items so
// the drawer can resume from the first unanswered question (null if none).
export const getOpenAttempt = createServerFn({ method: 'GET' })
  .validator((lessonId: string) => lessonId)
  .handler(async ({ data: lessonId }): Promise<OpenAttempt | null> => {
    const uid = currentUserId()
    if (uid == null) return null
    const att = await sql()`
      select id from sr_quiz_attempts
      where user_id = ${uid} and lesson_id = ${lessonId} and ended_at is null
      order by started_at desc limit 1
    `
    if (!att.length) return null
    const attemptId = Number(att[0].id)
    const rows = await sql()`
      select e.id, e.question_id, e.is_correct, e.chosen, e.answer_text,
             q.ord, q.correct_index, q.answer
      from sr_answer_events e join sr_questions q on q.id = e.question_id
      where e.attempt_id = ${attemptId}
      order by e.id
    `
    // Keep the latest event per question (max e.id via ascending overwrite).
    const byQ = new Map<number, AnsweredItem>()
    for (const r of rows) {
      byQ.set(Number(r.question_id), {
        questionId: Number(r.question_id),
        ord: r.ord,
        isCorrect: r.is_correct,
        chosen: r.chosen,
        typed: r.answer_text,
        correctIndex: r.correct_index,
        answer: r.answer,
      })
    }
    const answered = [...byQ.values()].sort((a, b) => a.ord - b.ord)
    return { attemptId, answered }
  })

// Start a fresh attempt (重新开始 / first open). At most one open attempt per
// learner+lesson: any existing open one (and its events, via cascade) is dropped.
export const startAttempt = createServerFn({ method: 'POST' })
  .validator((lessonId: string) => lessonId)
  .handler(async ({ data: lessonId }): Promise<{ attemptId: number } | { error: string }> => {
    const uid = currentUserId()
    if (uid == null) return { error: '请先登录' }
    await sql()`
      delete from sr_quiz_attempts
      where user_id = ${uid} and lesson_id = ${lessonId} and ended_at is null
    `
    const ins = await sql()`
      insert into sr_quiz_attempts (user_id, lesson_id) values (${uid}, ${lessonId})
      returning id
    `
    return { attemptId: Number(ins[0].id) }
  })

// End the current attempt (结束本课答题) and return its scorecard. The newest
// ended attempt is what getLatestScore reads, so ending refreshes the card.
export const endAttempt = createServerFn({ method: 'POST' })
  .validator((d: { attemptId: number; lessonId: string }) => d)
  .handler(async ({ data }): Promise<ScoreSummary | { error: string }> => {
    const uid = currentUserId()
    if (uid == null) return { error: '请先登录' }
    const upd = await sql()`
      update sr_quiz_attempts set ended_at = now()
      where id = ${data.attemptId} and user_id = ${uid} and ended_at is null
      returning ended_at
    `
    // If it was already ended (or missing), still summarize its frozen state.
    let endedAt: Date | string
    if (upd.length) {
      endedAt = upd[0].ended_at
    } else {
      const existing = await sql()`
        select ended_at from sr_quiz_attempts
        where id = ${data.attemptId} and user_id = ${uid}
      `
      if (!existing.length) return { error: '答题记录不存在' }
      endedAt = existing[0].ended_at ?? new Date()
    }
    const summary = await summarizeAttempt(data.lessonId, data.attemptId, endedAt)
    // STEMROBIN-30: record this attempt's percent into the progress model so the
    // homepage practice point reflects the latest attempt (>=80 completes, later
    // <80 regresses). Same percent the scorecard shows (attemptScorePercent);
    // server-authoritative — the client never supplies a score. Reuses
    // STEMROBIN-29's recordPracticeAttempt (its insert+prune rule) rather than
    // duplicating the storage logic here.
    await recordPracticeAttempt({
      data: {
        lessonId: data.lessonId,
        score: attemptScorePercent(summary.correct, summary.gradableTotal),
      },
    })
    return summary
  })
