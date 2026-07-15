import { describe, expect, it } from 'vitest'
import { computeProgress, type LessonReadChecks } from '~/lib/progress'

// Unit tests for the pure progress core (STEMROBIN-29). DB-bound behavior
// (latest-2 pruning, latest-wins ordering, event derivation) is verified
// empirically via psql — see .intentmill/.../tests/test-results.md. These tests
// pin the pure rules: reading-complete requires ALL read-checks correct (and >0),
// practice-complete uses the resolved latest score >= 80, totals = 2 × lessons,
// and the computation is locale-agnostic (keyed on lesson_id only).

const lessons: LessonReadChecks[] = [
  { lessonId: 'math-s2-01', readCheckIds: ['a', 'b', 'c'] },
  { lessonId: 'math-s2-08', readCheckIds: [] }, // real lesson with zero read-checks
]

function correct(map: Record<string, string[]>): Map<string, Set<string>> {
  return new Map(Object.entries(map).map(([k, v]) => [k, new Set(v)]))
}
function scores(map: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(map))
}

describe('computeProgress — reading', () => {
  it('reading-complete when every read-check is correct', () => {
    const p = computeProgress(
      [{ lessonId: 'L', readCheckIds: ['a', 'b', 'c'] }],
      correct({ L: ['a', 'b', 'c'] }),
      scores({}),
    )
    expect(p.lessons[0].readingComplete).toBe(true)
  })

  it('reading-incomplete when one read-check is missing', () => {
    const p = computeProgress(
      [{ lessonId: 'L', readCheckIds: ['a', 'b', 'c'] }],
      correct({ L: ['a', 'b'] }),
      scores({}),
    )
    expect(p.lessons[0].readingComplete).toBe(false)
  })

  it('reading-incomplete for a lesson with zero read-checks (BD-4, no vacuous truth)', () => {
    const p = computeProgress(
      [{ lessonId: 'L', readCheckIds: [] }],
      correct({ L: ['x', 'y'] }), // even with unrelated correct events
      scores({}),
    )
    expect(p.lessons[0].readingComplete).toBe(false)
  })

  it('reading-incomplete when the learner has no events at all', () => {
    const p = computeProgress(
      [{ lessonId: 'L', readCheckIds: ['a'] }],
      correct({}),
      scores({}),
    )
    expect(p.lessons[0].readingComplete).toBe(false)
  })
})

describe('computeProgress — practice', () => {
  it('practice-complete at the 80 threshold', () => {
    const p = computeProgress(
      [{ lessonId: 'L', readCheckIds: [] }],
      correct({}),
      scores({ L: 80 }),
    )
    expect(p.lessons[0].practiceComplete).toBe(true)
  })

  it('practice-incomplete just below threshold', () => {
    const p = computeProgress(
      [{ lessonId: 'L', readCheckIds: [] }],
      correct({}),
      scores({ L: 79.99 }),
    )
    expect(p.lessons[0].practiceComplete).toBe(false)
  })

  it('practice-complete for a high latest score', () => {
    const p = computeProgress(
      [{ lessonId: 'L', readCheckIds: [] }],
      correct({}),
      scores({ L: 85 }),
    )
    expect(p.lessons[0].practiceComplete).toBe(true)
  })

  it('practice regresses when the LATEST resolved score is below 80', () => {
    // The pure fn receives the already-resolved latest score; a regressed latest
    // (50) must read as incomplete. Latest-wins ordering is proven via psql.
    const p = computeProgress(
      [{ lessonId: 'L', readCheckIds: [] }],
      correct({}),
      scores({ L: 50 }),
    )
    expect(p.lessons[0].practiceComplete).toBe(false)
  })

  it('practice-incomplete when there is no attempt', () => {
    const p = computeProgress(
      [{ lessonId: 'L', readCheckIds: [] }],
      correct({}),
      scores({}),
    )
    expect(p.lessons[0].practiceComplete).toBe(false)
  })
})

describe('computeProgress — totals & locale-agnostic', () => {
  it('total points = 2 × lesson count', () => {
    const p = computeProgress(lessons, correct({}), scores({}))
    expect(p.lessonCount).toBe(2)
    expect(p.totalPoints).toBe(4)
  })

  it('completed points sum reading + practice across lessons', () => {
    const p = computeProgress(
      [
        { lessonId: 'A', readCheckIds: ['a'] }, // reading + practice complete → 2
        { lessonId: 'B', readCheckIds: ['b'] }, // reading only → 1
        { lessonId: 'C', readCheckIds: ['c'] }, // neither → 0
      ],
      correct({ A: ['a'], B: ['b'] }),
      scores({ A: 90 }),
    )
    expect(p.totalPoints).toBe(6)
    expect(p.completedPoints).toBe(3)
  })

  it('each lesson id appears once and contributes at most 2 points (locale-agnostic)', () => {
    // Inputs are keyed on lesson_id only; there is no locale axis. A lesson fully
    // complete counts exactly 2, never doubled per locale.
    const p = computeProgress(
      [{ lessonId: 'math-s2-01', readCheckIds: ['a'] }],
      correct({ 'math-s2-01': ['a'] }),
      scores({ 'math-s2-01': 100 }),
    )
    expect(p.lessons.filter((l) => l.lessonId === 'math-s2-01')).toHaveLength(1)
    expect(p.completedPoints).toBe(2)
    expect(p.totalPoints).toBe(2)
  })
})
