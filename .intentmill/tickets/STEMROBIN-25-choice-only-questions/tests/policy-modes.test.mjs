// STEMROBIN-25 — choice-only policy enforcement + reversibility (R1, R2, R3).
import assert from 'node:assert/strict'
import test from 'node:test'
import { CHOICE_ONLY, readCheckModes, exerciseModes } from '../../../../.agents/skills/sr-math-lesson/scripts/question-policy.mjs'
import { validateContent, validateItemKey } from '../../../../.agents/skills/sr-math-lesson/scripts/check-content.mjs'
import { validateExercises } from '../../../../.agents/skills/sr-math-lesson/scripts/check-exercises.mjs'

const has = (overlay) => (id) => Object.prototype.hasOwnProperty.call(overlay, id)

test('policy is choice-only and both helpers return only choice', () => {
  assert.equal(CHOICE_ONLY, true)
  assert.deepEqual(readCheckModes(), ['choice'])
  assert.deepEqual(exerciseModes(), ['choice'])
})

test('validateContent rejects an input read-check but accepts a choice read-check', () => {
  const overlay = { p: { t: 'body' }, q: { t: 'prompt?' }, o0: { t: 'a' }, o1: { t: 'b' } }
  const inputCard = { cards: [{ id: 'c1', num: 1, anchor: 'motivation', rev: 1, body: [{ kind: 'prose', id: 'p' }], read_check: [{ id: 'q', rev: 1, mode: 'input', key: { accept: ['x'] } }] }] }
  const p1 = validateContent({ content: JSON.parse(JSON.stringify(inputCard)), overlay, genre: '练习课', id: 'math-s99-01' })
  assert.ok(p1.some((m) => /mode must be one of choice/.test(m)), 'input read-check must be rejected under choice-only policy')

  const choiceCard = { cards: [{ id: 'c1', num: 1, anchor: 'motivation', rev: 1, body: [{ kind: 'prose', id: 'p' }], read_check: [{ id: 'q', rev: 1, mode: 'choice', options: ['o0', 'o1'], key: { correct_index: 0 } }] }] }
  const p2 = validateContent({ content: choiceCard, overlay, genre: '练习课', id: 'math-s99-01' })
  assert.deepEqual(p2, [], 'a well-formed choice read-check must pass')
})

test('validateExercises rejects input and work items under choice-only policy', () => {
  const ledger = { assumed: [], lessons: [{ id: 'math-s99-01', order: 1, introduces: [], consumes: [] }] }
  const overlay = { q: { t: 'p?' }, o0: { t: 'a' }, o1: { t: 'b' } }
  const mk = (mode, key) => ({ exercises: { items: [{ id: 'q', ord: 1, rev: 1, type: '操作', layer: '操作', mode, key, ...(mode === 'choice' ? { options: ['o0', 'o1'] } : {}) }] }, overlay, ledger, id: 'math-s99-01' })
  const inP = validateExercises(mk('input', { accept: ['1'] })).problems
  assert.ok(inP.some((m) => /mode must be one of choice/.test(m)), 'input exercise item must be rejected')
  const wkP = validateExercises(mk('work', { answer: 'because' })).problems
  assert.ok(wkP.some((m) => /mode must be one of choice/.test(m)), 'work exercise item must be rejected')
})

test('reversibility: the input code path in validateItemKey is intact (accepts input when the policy allows it)', () => {
  const overlay = { q: { t: 'p?' } }
  const inputItem = { id: 'q', rev: 1, mode: 'input', key: { accept: ['3a'] } }
  // Under the current choice-only policy the read-check gate refuses input:
  const narrowed = []
  validateItemKey(narrowed, 'rc', inputItem, overlay, has(overlay), ['choice'])
  assert.ok(narrowed.some((m) => /mode must be one of choice/.test(m)))
  // But the input validation branch still exists and passes when re-enabled
  // (CHOICE_ONLY=false path), proving the capability was narrowed, not removed:
  const reenabled = []
  validateItemKey(reenabled, 'rc', inputItem, overlay, has(overlay), ['choice', 'input'])
  assert.deepEqual(reenabled, [], 'input item stays valid when the policy re-enables input mode')
})
