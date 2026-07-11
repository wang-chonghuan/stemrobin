import { describe, expect, it } from 'vitest'

import {
  CURRICULUM,
  getAvailableLessons,
  getLessonLabel,
  getLessonNavForIds,
  getOutlineLessonId,
  withAvailableLessonIds,
} from './curriculum'

// SR-3-lesson-nav: prev/next navigation contract (spec R1–R5).
describe('getLessonNav', () => {
  const lessonIds = ['math-s2-03', 'math-s2-04', 'math-s2-07', 'math-s3-01']
  const availableLessons = getAvailableLessons(lessonIds)

  it('middle entry: prev/next are the adjacent AVAILABLE_LESSONS entries (R1/R2/R3)', () => {
    const nav = getLessonNavForIds('math-s2-04', lessonIds)
    expect(nav.prev).toEqual(availableLessons[0])
    expect(nav.next).toEqual(availableLessons[2])
  })

  it('first entry: no prev, next is the second entry (R4)', () => {
    const nav = getLessonNavForIds(availableLessons[0].id, lessonIds)
    expect(nav.prev).toBeUndefined()
    expect(nav.next).toEqual(availableLessons[1])
  })

  it('last entry: no next, prev is the second-to-last entry (R4)', () => {
    const last = availableLessons[availableLessons.length - 1]
    const nav = getLessonNavForIds(last.id, lessonIds)
    expect(nav.next).toBeUndefined()
    expect(nav.prev).toEqual(availableLessons[availableLessons.length - 2])
  })

  it('unknown ids get neither prev nor next (R5)', () => {
    expect(getLessonNavForIds('math-s2-99', lessonIds)).toEqual({})
    expect(getLessonNavForIds('', lessonIds)).toEqual({})
  })

  it('does not mutate CURRICULUM while deriving available lessons', () => {
    const snapshot = JSON.stringify(CURRICULUM)
    getAvailableLessons(lessonIds)
    getLessonNavForIds('math-s2-03', lessonIds)
    withAvailableLessonIds(lessonIds)
    expect(JSON.stringify(CURRICULUM)).toBe(snapshot)
  })
})

describe('DB-driven availability contract', () => {
  it('computes deterministic outline ids without storing manual availability in CURRICULUM', () => {
    expect(getOutlineLessonId('math', 2, 0)).toBe('math-s3-01')
    expect(getOutlineLessonId('physics', 0, 2)).toBe('physics-s1-03')
    expect(getOutlineLessonId('robot', 0, 0)).toBeNull()
    expect(CURRICULUM.flatMap((s) => s.stages.flatMap((st) => st.lessons)).some((l) => l.id)).toBe(false)
  })

  it('filters the outline by DB ids and keeps curriculum order', () => {
    const available = getAvailableLessons(['math-s3-01', 'math-s2-07'])
    expect(available).toEqual([
      { id: 'math-s2-07', title: '整式加减', subject: '数学' },
      { id: 'math-s3-01', title: '未知数是什么', subject: '数学' },
    ])
    for (const l of available) {
      expect(l.id).toBeTruthy()
      expect(l.title).toBeTruthy()
      expect(l.subject).toBeTruthy()
    }
  })

  it('adds ids only to available sidebar copies', () => {
    const outlined = withAvailableLessonIds(['math-s3-01'])
    expect(outlined[0].stages[2].lessons[0]).toEqual({
      id: 'math-s3-01',
      title: '未知数是什么',
    })
    expect(outlined[0].stages[2].lessons[1]).toEqual({ title: '等式两边同加同减' })
  })

  it('labels 3.1 from the human outline title', () => {
    expect(getLessonLabel('math-s3-01')).toBe('3.1 未知数是什么')
  })
})
