#!/usr/bin/env node
// STEMROBIN-20 ticket-scoped unit tests — deterministic modules of the
// JSONB-first sr-math-lesson generator. No DB; pure fixtures. Run:
//   node .intentmill/tickets/STEMROBIN-20-generator-jsonb-first/tests/unit-tests.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const S = join(root, '.agents/skills/sr-math-lesson/scripts')
const { validateLedger } = await import(join(S, 'ledger-core.mjs'))
const { validateContent } = await import(join(S, 'check-content.mjs'))
const { validateExercises } = await import(join(S, 'check-exercises.mjs'))
const { renderLessonHtml } = await import(join(S, 'render-lesson.mjs'))

let pass = 0, failn = 0
const results = []
function ok(name, cond, extra = '') { if (cond) { pass++; results.push(`  ✓ ${name}`) } else { failn++; results.push(`  ✗ ${name} ${extra}`) } }

// ---- fixtures: a minimal valid first-lesson 方法课 ----
function clone(x) { return JSON.parse(JSON.stringify(x)) }
const ledger = {
  subject: 'math', stage: 99, theme: 'SAMPLE 代数入门（disposable）',
  model: '字母是给一类数占的位置：把一句规律用字母写成式子，一次管住所有数。',
  assumed: [{ concept: '有理数加减乘除', from: 'stage-1' }],
  lessons: [{ id: 'math-s99-01', order: 1, title: '用字母表示数', genre: '方法课', status: 'generated',
    core_idea: '字母不是神秘符号，而是给一类数占位。', introduces: [{ term: '用字母表示数', kind: '方法' }, { term: '字母', kind: '概念' }],
    consumes: ['有理数加减乘除'], boundary_cases: [] }],
}
const anchors = ['motivation', 'explain', 'examples', 'connections', 'oral']
const substantial = ['motivation', 'explain', 'examples', 'connections']
const overlay = {}
const cards = anchors.map((anchor, i) => {
  const id = `c-${anchor}`
  overlay[`${id}-p`] = { t: `这是 ${anchor} 卡片的正文，含公式 $a+b$。`, src_rev: 1 }
  const card = { id, num: i + 1, anchor, rev: 1, body: [{ id: `${id}-p`, kind: 'prose' }, { kind: 'formula', tex: 'a+b=b+a' }], read_check: [] }
  if (substantial.includes(anchor)) {
    const rid = `${id}-rc1`
    overlay[rid] = { t: `${anchor}：刚读的这段主要在讲什么？`, src_rev: 1 }
    overlay[`${rid}:o0`] = { t: '用字母占位', src_rev: 1 }
    overlay[`${rid}:o1`] = { t: '一个具体的数', src_rev: 1 }
    card.read_check.push({ id: rid, mode: 'choice', options: [`${rid}:o0`, `${rid}:o1`], key: { correct_index: 0 }, rev: 1 })
  }
  return card
})
const content = { cards }
const items = []
const LAYERS = ['指认', '指认', '指认', '指认', '操作', '操作', '操作', '操作', '辨错', '辨错', '说理', '说理', '指认', '操作', '辨错', '说理']
const TYPEBY = { 指认: '辨认', 操作: '操作', 辨错: '辨错', 说理: '说理' }
for (let i = 0; i < 16; i++) {
  const id = `x-${i + 1}`
  const layer = LAYERS[i]
  overlay[id] = { t: `练习 ${i + 1}：$3a$ 当 $a=2$ 时的值？`, src_rev: 1 }
  overlay[`${id}:o0`] = { t: '6', src_rev: 1 }; overlay[`${id}:o1`] = { t: '5', src_rev: 1 }
  overlay[`${id}:o2`] = { t: '32', src_rev: 1 }; overlay[`${id}:o3`] = { t: '8', src_rev: 1 }
  items.push({ id, ord: i + 1, type: TYPEBY[layer], mode: 'choice', layer, review_of: null, options: [`${id}:o0`, `${id}:o1`, `${id}:o2`, `${id}:o3`], key: { correct_index: 0 }, rev: 1 })
}
const exercises = { items }
const meta = { id: 'math-s99-01', subject: 'math', stage: 99, order: 1, title: '用字母表示数', genre: '方法课', theme: ledger.theme, concept: ledger.lessons[0].core_idea }

// ---- ledger-core: behavior-preserving vs the CLI on the REAL stage-2 ledger ----
const realLedger = JSON.parse(readFileSync(join(root, 'resources/content/math-ledger/stage-2.json'), 'utf8'))
ok('ledger-core: real stage-2 ledger is valid (closure holds)', validateLedger(realLedger).problems.length === 0)
const brokenClosure = clone(realLedger); brokenClosure.lessons[1].consumes.push('不存在的术语XYZ')
ok('ledger-core: closure violation is caught', validateLedger(brokenClosure).problems.some((p) => p.includes('closure violation')))
ok('ledger-core: sample ledger valid', validateLedger(ledger).problems.length === 0)

// ---- check-content: valid + each violation ----
ok('content: valid fixture passes', validateContent({ content, overlay, genre: '方法课', id: 'math-s99-01' }).length === 0,
  JSON.stringify(validateContent({ content, overlay, genre: '方法课', id: 'math-s99-01' })))
const noNum = clone(content); delete noNum.cards[0].num
ok('content: missing num fails', validateContent({ content: noNum, overlay, genre: '方法课', id: 'x' }).some((p) => /num/.test(p)))
const noRC = clone(content); noRC.cards[1].read_check = [] // explain is substantial
ok('content: substantial card without read_check fails', validateContent({ content: noRC, overlay, genre: '方法课', id: 'x' }).some((p) => /read_check/.test(p)))
const wrongAnchors = clone(content); wrongAnchors.cards[0].anchor = 'model'
ok('content: wrong anchor set fails', validateContent({ content: wrongAnchors, overlay, genre: '方法课', id: 'x' }).some((p) => /anchors/.test(p)))
const keyInOverlay = clone(overlay); keyInOverlay['c-explain-rc1'] = { t: 'q', correct_index: 0 }
ok('content: KEY leaked into overlay fails', validateContent({ content, overlay: keyInOverlay, genre: '方法课', id: 'x' }).some((p) => /leaks answer KEY/.test(p)))
const missingProse = clone(content); missingProse.cards[0].body.push({ id: 'nope-id', kind: 'prose' })
ok('content: prose node with no overlay entry fails', validateContent({ content: missingProse, overlay, genre: '方法课', id: 'x' }).some((p) => /no overlay entry/.test(p)))

// ---- check-exercises: valid + violations ----
ok('exercises: valid 16-item first-lesson deck passes', validateExercises({ exercises, overlay, ledger, id: 'math-s99-01' }).problems.length === 0,
  JSON.stringify(validateExercises({ exercises, overlay, ledger, id: 'math-s99-01' }).problems))
const short = clone(exercises); short.items = short.items.slice(0, 10)
ok('exercises: <16 items fails', validateExercises({ exercises: short, overlay, ledger, id: 'math-s99-01' }).problems.some((p) => /16–24/.test(p)))
const badReview = clone(exercises); badReview.items[0].layer = '复习'; badReview.items[0].review_of = '不存在术语'
ok('exercises: review_of not an earlier term fails', validateExercises({ exercises: badReview, overlay, ledger, id: 'math-s99-01' }).problems.some((p) => /review_of/.test(p)))
const keyInExOverlay = clone(overlay); keyInExOverlay['x-1'] = { t: 'q', answer: 'secret' }
ok('exercises: KEY leak via overlay caught by content KEY-check', validateContent({ content, overlay: keyInExOverlay, genre: '方法课', id: 'x' }).some((p) => /leaks answer KEY/.test(p)))

// ---- render-lesson: anchors present, num labels, NO KEY tokens ----
const html = renderLessonHtml({ meta, content, exercises, overlay })
ok('render: emits all genre anchors', anchors.every((a) => html.includes(`data-sr-section="${a}"`)))
ok('render: emits practice section', html.includes('data-sr-section="practice"'))
ok('render: card num labels present', html.includes('<span class="sr-sec-num">1</span>') && html.includes('<span class="sr-sec-num">5</span>'))
ok('render: KaTeX wired (template head reused)', /katex/i.test(html) && html.includes('--sr-'))
ok('render: read-check prompt text rendered', html.includes('刚读的这段主要在讲什么'))
// KEY secrecy: the raw HTML must contain none of the key tokens.
const KEY_TOKENS = ['correct_index', '"accept"', 'answer":', 'key":']
ok('render: NO answer KEY token in HTML', !KEY_TOKENS.some((t) => html.includes(t)), `found: ${KEY_TOKENS.filter((t) => html.includes(t))}`)
// The correct option text ("用字母占位") appears, but there is no marker of WHICH is correct.
ok('render: options rendered without correctness marker', html.includes('用字母占位') && html.includes('一个具体的数') && !/correct/i.test(html))

console.log(results.join('\n'))
console.log(`\n${failn === 0 ? '✓ ALL PASS' : '✗ FAILURES'}: ${pass} passed, ${failn} failed`)
process.exit(failn === 0 ? 0 : 1)
