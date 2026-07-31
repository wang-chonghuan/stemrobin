import { describe, expect, it } from 'vitest'

import {
  localizeQuestionType,
  localizeSubject,
  t,
} from './i18n'

// The 16 migrated + fully en-translated math lessons.
const AVAILABLE_IDS = [
  ...Array.from({ length: 8 }, (_, i) => `math-s2-0${i + 1}`),
  ...Array.from({ length: 8 }, (_, i) => `math-s3-0${i + 1}`),
]

describe('t (UI string dictionary)', () => {
  it('interpolates {vars}', () => {
    expect(t('en', 'card.progress', { num: 2, total: 6 })).toBe('Card 2 / 6')
    expect(t('zh', 'card.progress', { num: 2, total: 6 })).toBe('第 2 / 6 张卡片')
  })

  it('returns distinct en vs zh strings for core learner-facing keys', () => {
    for (const key of [
      'lesson.back',
      'lesson.practice',
      'card.checksTitle',
      'card.openPractice',
      'quiz.title',
      'quiz.restart',
      'ov.title',
    ]) {
      expect(t('en', key)).not.toBe(t('zh', key))
      expect(t('en', key)).toBeTruthy()
    }
  })

  it('falls back to the key when a string is unknown (never blank)', () => {
    expect(t('en', 'no.such.key')).toBe('no.such.key')
  })
})

describe('label localization', () => {
  it('localizeSubject maps zh → en and passes through unknowns', () => {
    expect(localizeSubject('数学', 'en')).toBe('Math')
    expect(localizeSubject('数学', 'zh')).toBe('数学')
    expect(localizeSubject('未知', 'en')).toBe('未知')
  })


  it('localizeQuestionType maps the fixed vocabulary in en, passes through in zh', () => {
    expect(localizeQuestionType('辨认', 'en')).toBe('Identify')
    expect(localizeQuestionType('辨认', 'zh')).toBe('辨认')
    expect(localizeQuestionType('未知类型', 'en')).toBe('未知类型')
  })
})
