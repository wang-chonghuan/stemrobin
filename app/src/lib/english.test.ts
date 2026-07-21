import { describe, it, expect } from 'vitest'
import {
  tokenize,
  hiddenIndices,
  projectRecitation,
  projectReading,
  judgeSentence,
  judgeFreeText,
  isShortText,
  LADDER_RATIOS,
  type Level,
  maskPriority,
  type ShortTextContent,
} from './english'

const SENT = {
  id: 's1',
  num: 1,
  text: "Anna walks home from school every day.",
  targets: [1, 4], // walks, school
}

const CONTENT: ShortTextContent = {
  kind: 'short-text',
  theme: 'school day',
  sentences: [
    SENT,
    { id: 's2', num: 2, text: 'She sees a small cat near the road.', targets: [4] },
  ],
}

const LEVELS: Level[] = [1, 2, 3, 4, 5]

describe('short-text content shape', () => {
  it('discriminates short-text content from the math card tree', () => {
    expect(isShortText(CONTENT)).toBe(true)
    expect(isShortText({ cards: [] })).toBe(false)
    expect(isShortText(null)).toBe(false)
  })

  it('tokenizes words apart from punctuation/space, losslessly', () => {
    const t = tokenize(SENT.text)
    expect(t.filter((x) => x.isWord).map((x) => x.w)).toEqual([
      'Anna', 'walks', 'home', 'from', 'school', 'every', 'day',
    ])
    expect(t.map((x) => x.w).join('')).toBe(SENT.text)
  })
})

describe('recitation ladder', () => {
  it('hides a rising share of words across the five levels', () => {
    const tokens = tokenize(SENT.text)
    const counts = LEVELS.map((l) => hiddenIndices(tokens, SENT.targets, l).size)
    // strictly non-decreasing, ending with every word hidden
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1])
    expect(counts[4]).toBe(tokens.filter((t) => t.isWord).length)
    expect(LADDER_RATIOS[4]).toBe(1)
  })

  it('NESTS: every level hides everything the previous level hid, plus more', () => {
    const tokens = tokenize(SENT.text)
    for (let l = 2 as Level; l <= 5; l = (l + 1) as Level) {
      const prev = hiddenIndices(tokens, SENT.targets, (l - 1) as Level)
      const cur = hiddenIndices(tokens, SENT.targets, l)
      for (const i of prev) expect(cur.has(i)).toBe(true)
    }
  })

  it('hides the lesson target words first (level 1)', () => {
    const tokens = tokenize(SENT.text)
    const hidden = hiddenIndices(tokens, SENT.targets, 1)
    const hiddenWords = [...hidden].map((i) => tokens[i].w)
    expect(hiddenWords).toContain('walks')
    expect(hiddenWords).toContain('school')
  })

  it('is deterministic — same input, same mask', () => {
    const a = projectRecitation(CONTENT, 3)
    const b = projectRecitation(CONTENT, 3)
    expect(a).toEqual(b)
  })
})

describe('answer-key secrecy (charter G5)', () => {
  it('NEVER puts a hidden word’s text in the recitation payload, at any level', () => {
    for (const level of LEVELS) {
      const out = projectRecitation(CONTENT, level)
      const serialized = JSON.stringify(out)
      for (const s of out) {
        for (const tok of s.tokens) {
          // a hidden slot carries no `w` at all
          if ('hidden' in tok) expect('w' in tok).toBe(false)
        }
      }
      // at the top of the ladder the whole passage must be unreadable from the payload
      if (level === 5) {
        for (const word of ['Anna', 'walks', 'school', 'small', 'road']) {
          expect(serialized).not.toContain(word)
        }
      }
    }
  })

  it('does not leak the sentence text field into the recitation payload', () => {
    const out = projectRecitation(CONTENT, 1)
    expect(JSON.stringify(out)).not.toContain(SENT.text)
  })

  it('reading payload DOES carry text + gloss (the read phase shows them by design)', () => {
    const out = projectReading(CONTENT, { s1: { t: '安娜每天从学校走回家。', src_rev: 1 } }, new Set(['s1']))
    expect(out[0].text).toBe(SENT.text)
    expect(out[0].gloss).toBe('安娜每天从学校走回家。')
    expect(out[0].hasAudio).toBe(true)
    expect(out[1].gloss).toBeNull()
    expect(out[1].hasAudio).toBe(false)
  })
})

describe('judging', () => {
  it('accepts the right words for the blanks and reports no wrong slots', () => {
    const tokens = tokenize(SENT.text)
    const hidden = [...hiddenIndices(tokens, SENT.targets, 1)].sort((a, b) => a - b)
    const answers = hidden.map((i) => tokens[i].w)
    expect(judgeSentence(SENT, 1, answers)).toEqual({ isCorrect: true, wrong: [] })
  })

  it('ignores case and punctuation, but is strict on spelling', () => {
    expect(judgeFreeText(SENT.text, 'anna walks home from school every day')).toEqual({ isCorrect: true, wrong: [] })
    expect(judgeFreeText(SENT.text, 'ANNA WALKS HOME FROM SCHOOL EVERY DAY!!!')).toEqual({ isCorrect: true, wrong: [] })
    expect(judgeFreeText(SENT.text, 'Anna wallks home from school every day.').isCorrect).toBe(false)
  })

  it('is strict on word order', () => {
    const r = judgeFreeText(SENT.text, 'Anna home walks from school every day.')
    expect(r.isCorrect).toBe(false)
    expect(r.wrong).toContain(1)
  })

  it('reports positions only — a wrong answer yields indices, never the expected word', () => {
    const r = judgeSentence(SENT, 1, ['zzz', 'zzz'])
    expect(r.isCorrect).toBe(false)
    expect(r.wrong.length).toBeGreaterThan(0)
    expect(JSON.stringify(r)).not.toContain('walks')
    expect(JSON.stringify(r)).not.toContain('school')
  })

  it('flags a short submission’s missing tail as wrong positions', () => {
    const r = judgeFreeText(SENT.text, 'Anna walks home')
    expect(r.isCorrect).toBe(false)
    expect(r.wrong).toEqual([3, 4, 5, 6])
  })
})

// ── v2: patterns drive the ladder (STEMROBIN-87/89) ──────────────────────────
const PAT: ShortTextContent = {
  kind: 'short-text',
  v: 2,
  form: 'dialogue',
  patterns: [{ id: 'p1', template: 'Look ___ and ___ before you cross.' }],
  sentences: [
    {
      id: 's1', num: 1, speaker: 'Mom',
      text: 'Look left and right before you cross.',
      pattern: 'p1',
      slots: [1, 3], // left, right — the swappable part of the template
      targets: [6],  // cross
    },
  ],
}

describe('pattern slots drive the ladder', () => {
  it('L1 blanks the slot words, keeping the template frame visible', () => {
    const s = PAT.sentences[0]
    const tokens = tokenize(s.text)
    const hidden = hiddenIndices(tokens, s.targets, 1, s.slots)
    const hiddenWords = [...hidden].map((i) => tokens[i].w)
    // the swappable slot words go first...
    expect(hiddenWords).toContain('left')
    expect(hiddenWords).toContain('right')
    // ...while the fixed frame of the pattern stays readable at level 1
    for (const frame of ['Look', 'before', 'you']) expect(hiddenWords).not.toContain(frame)
  })

  it('ranks slots above targets above the rest', () => {
    const s = PAT.sentences[0]
    const tokens = tokenize(s.text)
    const order = maskPriority(tokens, s.targets, s.slots).map((i) => tokens[i].w)
    expect(order.slice(0, 2).sort()).toEqual(['left', 'right'])
    expect(order[2]).toBe('cross')
  })

  it('still NESTS with slots in play', () => {
    const s = PAT.sentences[0]
    const tokens = tokenize(s.text)
    for (let l = 2 as Level; l <= 5; l = (l + 1) as Level) {
      const prev = hiddenIndices(tokens, s.targets, (l - 1) as Level, s.slots)
      const cur = hiddenIndices(tokens, s.targets, l, s.slots)
      for (const i of prev) expect(cur.has(i)).toBe(true)
    }
  })

  it('keeps the speaker but never leaks a hidden word, at any level', () => {
    for (const level of LEVELS) {
      const out = projectRecitation(PAT, level)
      expect(out[0].speaker).toBe('Mom')
      const serialized = JSON.stringify(out)
      if (level === 5) {
        for (const w of ['Look', 'left', 'right', 'before', 'cross']) {
          expect(serialized).not.toContain(w)
        }
      }
    }
  })

  it('judges slot answers server-side without echoing them back', () => {
    const s = PAT.sentences[0]
    expect(judgeSentence(s, 1, ['left', 'right'])).toEqual({ isCorrect: true, wrong: [] })
    const bad = judgeSentence(s, 1, ['up', 'down'])
    expect(bad.isCorrect).toBe(false)
    expect(JSON.stringify(bad)).not.toContain('left')
  })
})
