import { describe, expect, it } from 'vitest'

import { localeReveal, projectQuestions } from './quiz'

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
      ['answerMode', 'figure', 'id', 'options', 'ord', 'prompt', 'type'].sort(),
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
