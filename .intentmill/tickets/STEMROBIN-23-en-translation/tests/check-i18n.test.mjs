// STEMROBIN-23 — ticket-scoped unit tests for the en-translation gate.
// Exercises validateI18n against crafted zh/en fixtures. Run:
//   node .intentmill/tickets/STEMROBIN-23-en-translation/tests/check-i18n.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const { validateI18n } = await import(join(root, '.agents/skills/sr-math-lesson/scripts/check-i18n.mjs'))

const zh = {
  p: { t: '<p>字母 $a$ 表示一个数。</p>', src_rev: 1 },
  q: { t: '$3a$ 的意思是？', src_rev: 1 },
  opt: { t: '字母', src_rev: 2 },
  blk: { t: '<div>方程 $$x+1=2$$ 有解。</div>', src_rev: 1 },
  fig: { t: '<svg role="img"><text>题目</text></svg> 看图。', src_rev: 1 },
}
const good = {
  p: { t: '<p>The letter $a$ stands for a number.</p>', src_rev: 1 },
  q: { t: 'What does $3a$ mean?', src_rev: 1 },
  opt: { t: 'A letter', src_rev: 2 },
  blk: { t: '<div>The equation $$x+1=2$$ has a solution.</div>', src_rev: 1 },
  fig: { t: '<svg role="img"><text>题目</text></svg> Look at the diagram.', src_rev: 1 },
}

test('R2/R3/R4/R5/R6: a faithful full translation passes with zero problems', () => {
  assert.deepEqual(validateI18n({ zh, en: good, id: 't' }), [])
})

test('R2: a missing node is reported', () => {
  const en = { ...good }; delete en.opt
  const p = validateI18n({ zh, en, id: 't' })
  assert.ok(p.some((m) => m.includes('missing node "opt"')), p.join('\n'))
})

test('R2: an extra node is reported', () => {
  const en = { ...good, ghost: { t: 'x', src_rev: 1 } }
  const p = validateI18n({ zh, en, id: 't' })
  assert.ok(p.some((m) => m.includes('extra node "ghost"')), p.join('\n'))
})

test('R3: non-string t and non-integer src_rev are reported', () => {
  const en = { ...good, opt: { t: 123, src_rev: 'x' } }
  const p = validateI18n({ zh, en, id: 't' })
  assert.ok(p.some((m) => m.includes('.t must be a string')), p.join('\n'))
  assert.ok(p.some((m) => m.includes('.src_rev must be an integer')), p.join('\n'))
})

test('R4: a leaked answer KEY field is rejected', () => {
  for (const kf of ['correct_index', 'accept', 'answer']) {
    const en = { ...good, opt: { t: 'A letter', src_rev: 2, [kf]: kf === 'correct_index' ? 0 : ['x'] } }
    const p = validateI18n({ zh, en, id: 't' })
    assert.ok(p.some((m) => m.includes(`leaks answer KEY field "${kf}"`)), `${kf}: ${p.join('\n')}`)
  }
})

test('R5: altering a $…$ formula fails', () => {
  const en = { ...good, q: { t: 'What does $3b$ mean?', src_rev: 1 } }
  const p = validateI18n({ zh, en, id: 't' })
  assert.ok(p.some((m) => m.includes('math spans differ')), p.join('\n'))
})

test('R5: dropping a $$…$$ block formula fails', () => {
  const en = { ...good, blk: { t: '<div>The equation has a solution.</div>', src_rev: 1 } }
  const p = validateI18n({ zh, en, id: 't' })
  assert.ok(p.some((m) => m.includes('math spans differ')), p.join('\n'))
})

test('R5: dropping an HTML tag fails', () => {
  const en = { ...good, p: { t: 'The letter $a$ stands for a number.', src_rev: 1 } }
  const p = validateI18n({ zh, en, id: 't' })
  assert.ok(p.some((m) => m.includes('HTML tag set differs')), p.join('\n'))
})

test('R5: altering the inline <svg> block fails', () => {
  const en = { ...good, fig: { t: '<svg role="img"><text>Problem</text></svg> Look at the diagram.', src_rev: 1 } }
  const p = validateI18n({ zh, en, id: 't' })
  assert.ok(p.some((m) => m.includes('inline <svg> blocks differ')), p.join('\n'))
})

test('R6: untranslated CJK residue in prose fails', () => {
  const en = { ...good, p: { t: '<p>The letter $a$ 表示 a number.</p>', src_rev: 1 } }
  const p = validateI18n({ zh, en, id: 't' })
  assert.ok(p.some((m) => m.includes('untranslated CJK residue')), p.join('\n'))
})

test('R6: CJK inside a neutral SVG block is NOT flagged (SVG stays source language)', () => {
  // good.fig keeps the Chinese <text>题目</text> inside the svg and translates the prose after it.
  const p = validateI18n({ zh: { fig: zh.fig }, en: { fig: good.fig }, id: 't' })
  assert.deepEqual(p, [])
})

test('a node with no prose (pure formula) passes when copied verbatim', () => {
  const z = { f: { t: '$a\\times b$', src_rev: 1 } }
  assert.deepEqual(validateI18n({ zh: z, en: { f: { t: '$a\\times b$', src_rev: 1 } }, id: 't' }), [])
})
