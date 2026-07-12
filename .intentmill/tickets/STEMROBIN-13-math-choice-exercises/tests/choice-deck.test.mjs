import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildChoiceDeck, immutableSnapshot } from '../../../../.agents/skills/sr-math-lesson/scripts/choice-deck.mjs'

const source = [
  {
    ord: 1,
    layer: '指认',
    review_of: null,
    type: '辨认',
    prompt: '$x$ 的系数是？',
    answer_mode: 'input',
    accept: ['1'],
    options: null,
    correct_index: null,
    answer: '$1$。省略系数时，系数是 $1$。',
  },
  {
    ord: 2,
    layer: '说理',
    review_of: null,
    type: '说理',
    prompt: '为什么负号要跟着项走？',
    answer_mode: 'work',
    accept: null,
    options: null,
    correct_index: null,
    answer: '参考讲法：先把减法改写成加相反数，负号属于这一项。',
  },
]

const converted = buildChoiceDeck(source)
assert.deepEqual(immutableSnapshot(converted), immutableSnapshot(source))
assert.equal(converted.every((question) => question.answer_mode === 'choice'), true)
assert.equal(converted.some((question) => question.options.length >= 5), true)
for (const question of converted) {
  assert.equal(question.accept, null)
  assert.equal(new Set(question.options).size, question.options.length)
  assert.equal(question.options[question.correct_index] !== undefined, true)
}

const dir = mkdtempSync(join(tmpdir(), 'stemrobin-choice-deck-test-'))
try {
  const deck = Array.from({ length: 20 }, (_, index) => ({
    ord: index + 1,
    layer: index < 5 ? '指认' : index < 10 ? '操作' : index < 13 ? '辨错' : '说理',
    review_of: null,
    type: index < 5 ? '辨认' : index < 10 ? '操作' : index < 13 ? '辨错' : '说理',
    prompt: `示例题 ${index + 1}`,
    answer_mode: 'choice',
    accept: null,
    options: ['正确', '错误甲', '错误乙', '错误丙'],
    correct_index: 0,
    answer: '这是参考讲解。',
  }))
  const validPath = join(dir, 'valid.json')
  writeFileSync(validPath, `${JSON.stringify(deck)}\n`)
  execFileSync(process.execPath, [
    '.agents/skills/sr-math-lesson/scripts/check-exercises.mjs',
    validPath,
    '--ledger',
    'resources/content/math-ledger/stage-3.json',
    '--id',
    'math-s3-01',
  ], { stdio: 'inherit' })

  deck[0].answer_mode = 'input'
  const invalidPath = join(dir, 'invalid.json')
  writeFileSync(invalidPath, `${JSON.stringify(deck)}\n`)
  assert.throws(() => execFileSync(process.execPath, [
    '.agents/skills/sr-math-lesson/scripts/check-exercises.mjs',
    invalidPath,
    '--ledger',
    'resources/content/math-ledger/stage-3.json',
    '--id',
    'math-s3-01',
  ], { stdio: 'ignore' }))
} finally {
  rmSync(dir, { recursive: true, force: true })
}

console.log('choice deck checks passed')
