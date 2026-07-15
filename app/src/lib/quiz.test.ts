import { describe, expect, it } from 'vitest'
import { attemptScorePercent } from './quiz'

// STEMROBIN-30: the attempt score percent is the single definition of "本次分数".
// It is both what the learner sees on the scorecard and what endAttempt records
// into the progress model, so the practice point (>=80 complete, later <80
// regresses) matches the shown score exactly. Pin the formula + the boundary
// that getProgress's practice signal depends on.
describe('attemptScorePercent', () => {
  it('is (correct / gradableTotal) rounded to a percent', () => {
    expect(attemptScorePercent(4, 5)).toBe(80)
    expect(attemptScorePercent(5, 5)).toBe(100)
    expect(attemptScorePercent(0, 5)).toBe(0)
  })

  it('rounds to the nearest whole percent', () => {
    expect(attemptScorePercent(2, 3)).toBe(67) // 66.66… → 67
    expect(attemptScorePercent(1, 3)).toBe(33) // 33.33… → 33
  })

  it('crosses the practice-complete threshold at 80', () => {
    expect(attemptScorePercent(8, 10)).toBe(80) // ⇒ practiceComplete
    expect(attemptScorePercent(7, 10)).toBe(70) // ⇒ regresses below 80
  })

  it('is 0 for an all-说理/work deck (no gradable items) — never divides by zero', () => {
    expect(attemptScorePercent(0, 0)).toBe(0)
  })
})
