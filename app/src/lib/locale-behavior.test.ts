import { describe, expect, it } from 'vitest'

import { lessonAvailableInLocale } from './lessons'
import {
  getAvailableLessons,
  getLessonLabel,
  withAvailableLessonIds,
} from './curriculum'
import { localeReveal, projectQuestions } from './quiz'

// ── Per-locale availability rule (clean D5) ──────────────────────────────────
describe('lessonAvailableInLocale', () => {
  const referenced = ['n1', 'n2', 'n3'] // nodes a lesson references

  it('is available when the overlay covers every referenced node', () => {
    expect(lessonAvailableInLocale(referenced, new Set(['n1', 'n2', 'n3', 'extra']))).toBe(true)
  })

  it('is NOT available when the overlay misses even one node (no half-translation)', () => {
    // zh covers all → available; a partial en (missing n3) → hidden. This is the
    // exact "untranslated lesson does not appear under en" acceptance behavior.
    const zhKeys = new Set(['n1', 'n2', 'n3'])
    const enKeys = new Set(['n1', 'n2']) // n3 not translated to en
    expect(lessonAvailableInLocale(referenced, zhKeys)).toBe(true)
    expect(lessonAvailableInLocale(referenced, enKeys)).toBe(false)
  })

  it('an empty overlay makes any non-empty lesson unavailable', () => {
    expect(lessonAvailableInLocale(referenced, new Set())).toBe(false)
    expect(lessonAvailableInLocale([], new Set())).toBe(true) // trivially covered
  })
})

// ── Catalog outline localization + en filtering ──────────────────────────────
describe('withAvailableLessonIds locale', () => {
  it('zh keeps the FULL outline with placeholders (unchanged behavior)', () => {
    const zh = withAvailableLessonIds(['math-s2-01'], 'zh')
    // every subject + stage of the source outline is present
    expect(zh.length).toBeGreaterThan(1)
    const math = zh.find((s) => s.subject === 'math')!
    expect(math.label).toBe('数学')
    expect(math.stages.length).toBeGreaterThan(2)
    // the available lesson carries an id, the rest are greyed placeholders
    expect(math.stages[1].lessons[0]).toEqual({ id: 'math-s2-01', title: '用字母表示数' })
    expect(math.stages[1].lessons[1]).toEqual({ title: '代数式与求值' })
  })

  it('en shows ONLY available lessons, localized, with empty stages/subjects dropped', () => {
    const en = withAvailableLessonIds(['math-s2-01', 'math-s2-02'], 'en')
    // physics (no available lessons) is dropped
    expect(en.every((s) => s.subject === 'math')).toBe(true)
    const math = en[0]
    expect(math.label).toBe('Math')
    // only the stage that holds available lessons remains
    expect(math.stages).toHaveLength(1)
    expect(math.stages[0].title).toBe('Letters and Algebraic Expressions')
    expect(math.stages[0].lessons).toEqual([
      { id: 'math-s2-01', title: 'Using Letters to Represent Numbers' },
      { id: 'math-s2-02', title: 'Algebraic Expressions and Evaluation' },
    ])
  })
})

describe('getAvailableLessons + getLessonLabel locale', () => {
  it('localizes title + subject under en', () => {
    expect(getAvailableLessons(['math-s2-01'], 'en')).toEqual([
      { id: 'math-s2-01', title: 'Using Letters to Represent Numbers', subject: 'Math' },
    ])
  })

  it('keeps zh source strings under zh (regression)', () => {
    expect(getAvailableLessons(['math-s2-01'], 'zh')).toEqual([
      { id: 'math-s2-01', title: '用字母表示数', subject: '数学' },
    ])
  })

  it('getLessonLabel keeps the neutral number prefix, localizes the title', () => {
    expect(getLessonLabel('math-s2-01', 'en')).toBe('2.1 Using Letters to Represent Numbers')
    expect(getLessonLabel('math-s2-01', 'zh')).toBe('2.1 用字母表示数')
  })
})

// ── Practice-deck projection: KEY-free + locale text ─────────────────────────
describe('projectQuestions', () => {
  const rows = [
    {
      id: 101,
      ord: 1,
      type: '辨认',
      prompt: '$3a$ 的意思是？',
      answer_mode: 'choice' as const,
      options: ['$3\\times a$', '$3+a$', '拼成两位数', '$a-3$'],
    },
  ]
  const exercises = {
    items: [
      { id: 'L-ex01', ord: 1, mode: 'choice', options: ['L-ex01-o0', 'L-ex01-o1', 'L-ex01-o2', 'L-ex01-o3'] },
    ],
  }
  const overlay = {
    'L-ex01': { t: 'What does $3a$ mean?', src_rev: 1 },
    'L-ex01-o0': { t: '$3\\times a$', src_rev: 1 },
    'L-ex01-o1': { t: '$3+a$', src_rev: 1 },
    'L-ex01-o2': { t: 'concatenate into two digits', src_rev: 1 },
    'L-ex01-o3': { t: '$a-3$', src_rev: 1 },
  }

  it('zh returns the relational text verbatim', () => {
    const out = projectQuestions(rows, null, {}, 'zh')
    expect(out[0].prompt).toBe('$3a$ 的意思是？')
    expect(out[0].type).toBe('辨认')
    expect(out[0].options).toEqual(rows[0].options)
  })

  it('en sources prompt/options from the overlay and localizes the type', () => {
    const out = projectQuestions(rows, exercises, overlay, 'en')
    expect(out[0].prompt).toBe('What does $3a$ mean?')
    expect(out[0].type).toBe('Identify')
    expect(out[0].options).toEqual([
      '$3\\times a$',
      '$3+a$',
      'concatenate into two digits',
      '$a-3$',
    ])
  })

  it('never leaks a KEY (no correct_index / accept / answer in the projected item)', () => {
    const out = projectQuestions(rows, exercises, overlay, 'en')
    expect(Object.keys(out[0]).sort()).toEqual(
      ['answerMode', 'id', 'options', 'ord', 'prompt', 'type'].sort(),
    )
  })
})

describe('localeReveal (reference-explanation suppression)', () => {
  it('returns the zh reference under the source locale', () => {
    expect(localeReveal('zh', '这是解析')).toBe('这是解析')
  })
  it('suppresses the reference (no half-Chinese) under en', () => {
    expect(localeReveal('en', '这是解析')).toBe('')
  })
})
