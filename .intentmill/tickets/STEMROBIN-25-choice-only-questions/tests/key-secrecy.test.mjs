// STEMROBIN-25 — answer-key secrecy for converted read-checks (R6).
import assert from 'node:assert/strict'
import test from 'node:test'
import { validateContent, KEY_FIELDS } from '../../../../.agents/skills/sr-math-lesson/scripts/check-content.mjs'

test('a converted read-check keeps correct_index in the neutral content base, never the overlay', () => {
  // Shape produced by the STEMROBIN-25 transform.
  const rc = { id: 'math-s99-01-motivation-rc0', rev: 1, mode: 'choice', options: ['math-s99-01-motivation-rc0-o0', 'math-s99-01-motivation-rc0-o1'], key: { correct_index: 1 } }
  assert.equal(rc.key.correct_index, 1, 'KEY lives in the content item')
  const overlay = {
    p: { t: 'body' },
    'math-s99-01-motivation-rc0': { t: 'prompt?', src_rev: 1 },
    'math-s99-01-motivation-rc0-o0': { t: '$3a$', src_rev: 1 },
    'math-s99-01-motivation-rc0-o1': { t: '$a3$', src_rev: 1 },
  }
  for (const [nid, e] of Object.entries(overlay)) for (const kf of KEY_FIELDS) assert.ok(!(kf in e), `overlay ${nid} must not carry KEY field ${kf}`)
  const content = { cards: [{ id: 'c1', num: 1, anchor: 'motivation', rev: 1, body: [{ kind: 'prose', id: 'p' }], read_check: [rc] }] }
  assert.deepEqual(validateContent({ content, overlay, genre: '练习课', id: 'math-s99-01' }), [], 'clean converted item + KEY-free overlay validates')
})

test('validateContent rejects an overlay that leaks a KEY field', () => {
  const rc = { id: 'q', rev: 1, mode: 'choice', options: ['o0', 'o1'], key: { correct_index: 0 } }
  const overlay = { p: { t: 'b' }, q: { t: 'p?' }, o0: { t: 'a', correct_index: 0 }, o1: { t: 'b' } }
  const problems = validateContent({ content: { cards: [{ id: 'c1', num: 1, anchor: 'motivation', rev: 1, body: [{ kind: 'prose', id: 'p' }], read_check: [rc] }] }, overlay, genre: '练习课', id: 'math-s99-01' })
  assert.ok(problems.some((m) => /leaks answer KEY field "correct_index"/.test(m)), 'a KEY field in an overlay entry must fail validation')
})
