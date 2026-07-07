import { describe, expect, it } from 'vitest'

import { AVAILABLE_LESSONS, CURRICULUM, getLessonNav } from './curriculum'

// SR-3-lesson-nav: prev/next navigation contract (spec R1–R5).
describe('getLessonNav', () => {
  it('middle entry: prev/next are the adjacent AVAILABLE_LESSONS entries (R1/R2/R3)', () => {
    const nav = getLessonNav(AVAILABLE_LESSONS[1].id)
    expect(nav.prev).toEqual(AVAILABLE_LESSONS[0])
    expect(nav.next).toEqual(AVAILABLE_LESSONS[2])
  })

  it('first entry: no prev, next is the second entry (R4)', () => {
    const nav = getLessonNav(AVAILABLE_LESSONS[0].id)
    expect(nav.prev).toBeUndefined()
    expect(nav.next).toEqual(AVAILABLE_LESSONS[1])
  })

  it('last entry: no next, prev is the second-to-last entry (R4)', () => {
    const last = AVAILABLE_LESSONS[AVAILABLE_LESSONS.length - 1]
    const nav = getLessonNav(last.id)
    expect(nav.next).toBeUndefined()
    expect(nav.prev).toEqual(AVAILABLE_LESSONS[AVAILABLE_LESSONS.length - 2])
  })

  it('unknown ids get neither prev nor next (R5)', () => {
    expect(getLessonNav('math-s2-99')).toEqual({})
    expect(getLessonNav('')).toEqual({})
  })

  it('does not mutate AVAILABLE_LESSONS (pure derivation, no second order source)', () => {
    const ref = AVAILABLE_LESSONS
    const len = AVAILABLE_LESSONS.length
    const snapshot = AVAILABLE_LESSONS.map((l) => l.id)
    getLessonNav(AVAILABLE_LESSONS[0].id)
    getLessonNav('math-s2-99')
    expect(AVAILABLE_LESSONS).toBe(ref)
    expect(AVAILABLE_LESSONS.length).toBe(len)
    expect(AVAILABLE_LESSONS.map((l) => l.id)).toEqual(snapshot)
  })
})

// Sequence contract regression: AVAILABLE_LESSONS stays exactly the CURRICULUM
// flattening of id-bearing lessons, in order (R1 + index.tsx consumer shape).
describe('AVAILABLE_LESSONS order contract', () => {
  it('matches the CURRICULUM flattening of lessons that have pages', () => {
    const expected = CURRICULUM.flatMap((s) =>
      s.stages.flatMap((st) =>
        st.lessons
          .filter((l) => l.id)
          .map((l) => ({ id: l.id!, title: l.title, subject: s.label })),
      ),
    )
    expect(AVAILABLE_LESSONS).toEqual(expected)
  })

  it('every entry has a non-empty id, title, and subject', () => {
    expect(AVAILABLE_LESSONS.length).toBeGreaterThan(0)
    for (const l of AVAILABLE_LESSONS) {
      expect(l.id).toBeTruthy()
      expect(l.title).toBeTruthy()
      expect(l.subject).toBeTruthy()
    }
  })
})
