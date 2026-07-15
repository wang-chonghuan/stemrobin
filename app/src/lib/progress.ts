import { createServerFn } from '@tanstack/react-start'
import { sql } from '~/lib/db'
import { currentUserId } from '~/lib/session.server'

// Practice-attempt storage + progress computation (STEMROBIN-29). This is the
// server-side enabler for STEMROBIN-30 (practice scoring + real homepage progress
// bar); it has NO user-facing UI of its own.
//
// Two learner signals, aggregated per lesson and LOCALE-AGNOSTIC (keyed on
// lesson_id only — the same lesson in zh/en shares one lesson_id, so it is one
// point-pair, never double-counted per locale):
//   • reading-complete  — the learner walked all cards = every read-check of the
//     lesson has a correct event (sr_content_answer_events kind='read_check',
//     is_correct=true). Derived from existing events; NO new reading table.
//   • practice-complete — the LATEST practice attempt's score >= 80 (percent).
//     Regresses: a later attempt below 80 flips it back to incomplete.
// Totals: total points = 2 × (number of lessons in sr_lessons); completed points
// = Σ (reading-complete + practice-complete) over lessons.
//
// Practice scores live in sr_practice_attempts, keeping only the latest TWO
// attempts per (user, lesson) — recordPracticeAttempt prunes the older ones after
// each insert (human ruling: current + previous only). Answer-key secrecy holds:
// this module reads only read-check ids and is_correct, never any key material.

const PRACTICE_PASS_SCORE = 80 // percent; latest attempt >= this ⇒ practice-complete

// ── Pure, DB-free progress core (unit-tested independently of DB/request) ──────

export type LessonReadChecks = {
  lessonId: string
  readCheckIds: string[] // every read-check id the lesson's content defines
}
export type LessonProgress = {
  lessonId: string
  readingComplete: boolean
  practiceComplete: boolean
}
export type Progress = {
  lessons: LessonProgress[]
  lessonCount: number
  totalPoints: number // 2 × lessonCount
  completedPoints: number // Σ (readingComplete + practiceComplete)
}

// Pure computation. Inputs are keyed on lesson_id ONLY (locale-agnostic).
//   lessons                     — every lesson + the read-check ids it defines
//   correctReadCheckIdsByLesson — lessonId → set of read-check ids answered correctly
//   latestScoreByLesson         — lessonId → the learner's LATEST attempt score (percent)
export function computeProgress(
  lessons: readonly LessonReadChecks[],
  correctReadCheckIdsByLesson: ReadonlyMap<string, ReadonlySet<string>>,
  latestScoreByLesson: ReadonlyMap<string, number>,
): Progress {
  const perLesson: LessonProgress[] = lessons.map((l) => {
    const correct = correctReadCheckIdsByLesson.get(l.lessonId)
    // A lesson with zero read-checks is never reading-complete via this signal
    // (BD-4): "every read-check correct" must not be vacuously true for a lesson
    // that has no read-check gate, else it would count for untouched learners.
    const readingComplete =
      l.readCheckIds.length > 0 &&
      l.readCheckIds.every((id) => correct?.has(id) ?? false)
    const latest = latestScoreByLesson.get(l.lessonId)
    const practiceComplete = latest != null && latest >= PRACTICE_PASS_SCORE
    return { lessonId: l.lessonId, readingComplete, practiceComplete }
  })
  const completedPoints = perLesson.reduce(
    (n, p) => n + (p.readingComplete ? 1 : 0) + (p.practiceComplete ? 1 : 0),
    0,
  )
  return {
    lessons: perLesson,
    lessonCount: lessons.length,
    totalPoints: 2 * lessons.length,
    completedPoints,
  }
}

// ── Server functions (DB-bound; verified empirically) ─────────────────────────

export type RecordAttemptResult = { ok: true } | { error: string }

// Record one graded practice attempt for the logged-in learner and prune that
// (user, lesson) group to the latest TWO attempts. `score` is a percent in
// [0,100]. Writes nothing when logged out. The single source of the practice
// score-writing rule; the quiz attempt-end path (quiz.ts endAttempt) invokes
// this same server fn so the recorded percent — the one the scorecard shows —
// drives getProgress's practice signal (STEMROBIN-30).
export const recordPracticeAttempt = createServerFn({ method: 'POST' })
  .validator((d: { lessonId: string; score: number }) => d)
  .handler(async ({ data }): Promise<RecordAttemptResult> => {
    const uid = currentUserId()
    if (uid == null) return { error: '请先登录' }
    if (typeof data.score !== 'number' || data.score < 0 || data.score > 100) {
      return { error: '分数无效' }
    }
    await sql()`
      insert into sr_practice_attempts (user_id, lesson_id, score)
      values (${uid}, ${data.lessonId}, ${data.score})
    `
    // Keep only the latest two attempts per (user, lesson). Newest = highest
    // submitted_at, tie-broken by id (identity is monotonic). Done in the
    // recording path per the human ruling — not a trigger.
    await sql()`
      delete from sr_practice_attempts
      where user_id = ${uid} and lesson_id = ${data.lessonId}
        and id not in (
          select id from sr_practice_attempts
          where user_id = ${uid} and lesson_id = ${data.lessonId}
          order by submitted_at desc, id desc
          limit 2
        )
    `
    return { ok: true }
  })

// Progress for the current learner. Locale-agnostic: every query keys on
// lesson_id only. Logged out ⇒ all lessons incomplete but correct totals.
export const getProgress = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Progress> => {
    // Every lesson + the read-check ids it defines (including lessons with none).
    const lessonRows = await sql()`
      select l.id as lesson_id, rc->>'id' as node_id
        from sr_lessons l
        left join lateral jsonb_array_elements(
          coalesce(l.content->'cards', '[]'::jsonb)
        ) c on true
        left join lateral jsonb_array_elements(
          coalesce(c->'read_check', '[]'::jsonb)
        ) rc on true
    `
    const readCheckIdsByLesson = new Map<string, string[]>()
    for (const r of lessonRows) {
      const list = readCheckIdsByLesson.get(r.lesson_id) ?? []
      if (r.node_id != null) list.push(r.node_id as string)
      readCheckIdsByLesson.set(r.lesson_id, list)
    }
    const lessons: LessonReadChecks[] = [...readCheckIdsByLesson.entries()].map(
      ([lessonId, readCheckIds]) => ({ lessonId, readCheckIds }),
    )

    const correctByLesson = new Map<string, Set<string>>()
    const latestScoreByLesson = new Map<string, number>()

    const uid = currentUserId()
    if (uid != null) {
      // Read-checks answered correctly by this learner (locale-agnostic: no
      // locale filter — a correct answer in any locale counts for the lesson).
      const correctRows = await sql()`
        select distinct lesson_id, node_id
          from sr_content_answer_events
          where user_id = ${uid} and kind = 'read_check' and is_correct = true
      `
      for (const r of correctRows) {
        const set = correctByLesson.get(r.lesson_id) ?? new Set<string>()
        set.add(r.node_id as string)
        correctByLesson.set(r.lesson_id, set)
      }
      // Latest attempt score per lesson (submitted_at desc, id desc).
      const scoreRows = await sql()`
        select distinct on (lesson_id) lesson_id, score
          from sr_practice_attempts
          where user_id = ${uid}
          order by lesson_id, submitted_at desc, id desc
      `
      for (const r of scoreRows) {
        latestScoreByLesson.set(r.lesson_id, Number(r.score))
      }
    }

    return computeProgress(lessons, correctByLesson, latestScoreByLesson)
  },
)
