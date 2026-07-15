// STEMROBIN-25 — the input→choice conversion shape + en/zh coverage parity (R4, R5, R7).
import assert from 'node:assert/strict'
import test from 'node:test'
import { validateI18n } from '../../../../.agents/skills/sr-math-lesson/scripts/check-i18n.mjs'

// Mirror of scratch/transform.mjs for one item (kept in-test so the assertion is self-contained).
function convert(rc, conv, zh, en) {
  const optIds = conv.options.map((_, k) => `${rc.id}-o${k}`)
  const out = { ...rc, mode: 'choice', options: optIds, key: { correct_index: conv.ci } }
  delete out.key.accept
  conv.options.forEach((o, k) => { zh[optIds[k]] = { t: o.zh, src_rev: 1 }; en[optIds[k]] = { t: o.en, src_rev: 1 } })
  return out
}

test('input read-check converts to a 4-option choice with the prompt preserved and matched en/zh coverage', () => {
  const rc = { id: 'math-s99-01-explain-rc1', rev: 1, mode: 'input', key: { accept: ['3a'] } }
  const conv = { ci: 1, options: [ { zh: '$a3$', en: '$a3$' }, { zh: '$3a$', en: '$3a$' }, { zh: '$3+a$', en: '$3+a$' }, { zh: '$a^3$', en: '$a^3$' } ] }
  const zh = { 'math-s99-01-explain-rc1': { t: '省略乘号后写作什么？', src_rev: 1 } }
  const en = { 'math-s99-01-explain-rc1': { t: 'How is it written after omitting the sign?', src_rev: 1 } }

  const out = convert(rc, conv, zh, en)
  assert.equal(out.mode, 'choice')
  assert.equal(out.id, 'math-s99-01-explain-rc1', 'prompt node id (concept) preserved')
  assert.equal(out.options.length, 4, 'exactly 4 options')
  assert.equal(new Set(out.options).size, 4, 'option ids distinct')
  assert.ok(Number.isInteger(out.key.correct_index) && out.key.correct_index >= 0 && out.key.correct_index < 4, 'correct_index in range')
  assert.ok(!('accept' in out.key), 'input accept removed')
  for (const oid of out.options) { assert.ok(oid in zh, 'zh overlay has option'); assert.ok(oid in en, 'en overlay has option') }

  // en coverage == zh, KEY-free, formulas byte-identical, no CJK residue.
  assert.deepEqual(validateI18n({ zh, en, id: 'math-s99-01' }), [], 'en overlay covers zh exactly and passes the i18n gate')
})

test('a converted item with a zh option missing its en entry fails the coverage gate', () => {
  const zh = { q: { t: 'p?', src_rev: 1 }, 'q-o0': { t: '$3a$', src_rev: 1 } }
  const en = { q: { t: 'p?', src_rev: 1 } } // missing q-o0
  const problems = validateI18n({ zh, en, id: 'math-s99-01' })
  assert.ok(problems.some((m) => /missing node "q-o0"/.test(m)), 'missing en option node must fail coverage')
})
