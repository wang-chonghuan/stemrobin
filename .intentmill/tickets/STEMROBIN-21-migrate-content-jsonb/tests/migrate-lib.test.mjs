// STEMROBIN-21 — offline unit tests for the migration library (no DB).
// Run: node --test .intentmill/tickets/STEMROBIN-21-migrate-content-jsonb/tests/migrate-lib.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { splitSectionChildren, htmlToCards, deckToExercises, mergeReadChecks } from '../../../../.agents/skills/sr-math-lesson/scripts/migrate-lib.mjs'
import { validateContent } from '../../../../.agents/skills/sr-math-lesson/scripts/check-content.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fx = (id) => readFileSync(join(here, 'fixtures', `${id}.html`), 'utf8')

// helper: overlay must never carry a KEY field
function assertNoKeyInOverlay(overlay) {
  for (const [nid, e] of Object.entries(overlay)) {
    assert.equal(typeof e.t, 'string', `overlay ${nid} has t`)
    for (const kf of ['correct_index', 'accept', 'answer']) assert.ok(!(kf in e), `overlay ${nid} leaks ${kf}`)
  }
}

test('splitSectionChildren: top-level split handles nested same-tag + figure/svg', () => {
  const inner = `<p>a <strong>b</strong></p>
    <div class="sr-example"><div class="sr-step"><span>x</span></div><div class="sr-step">y</div></div>
    <figure class="sr-fig"><svg><rect x="1"/><text>加法层</text></svg><figcaption>cap</figcaption></figure>
    <ol class="sr-oral"><li>one</li><li>two</li></ol>`
  const kids = splitSectionChildren(inner)
  assert.deepEqual(kids.map((k) => k.tag), ['p', 'div', 'figure', 'ol'])
  // the sr-example div must be captured whole (both steps inside one child)
  assert.ok(kids[1].html.includes('y</div></div>'))
  assert.ok(kids[2].html.includes('</svg>'))
})

test('htmlToCards: concept lesson yields genre-exact anchors, num 1..N, practice dropped', () => {
  const { cards, overlay } = htmlToCards({ html: fx('math-s2-03'), genre: '概念课', id: 'math-s2-03' })
  assert.deepEqual(cards.map((c) => c.anchor), ['motivation', 'model', 'anatomy', 'boundary', 'connections', 'oral'])
  assert.deepEqual(cards.map((c) => c.num), [1, 2, 3, 4, 5, 6])
  assert.ok(!cards.some((c) => c.anchor === 'practice'))
  for (const c of cards) assert.ok(c.body.length > 0, `${c.anchor} has body`)
  // the model card carries the tree SVG as a neutral svg node
  const model = cards.find((c) => c.anchor === 'model')
  assert.ok(model.body.some((n) => n.kind === 'svg' && n.svg.includes('<svg')), 'model has svg node')
  // every prose node id resolves in the overlay
  for (const c of cards) for (const n of c.body) if (n.kind === 'prose') assert.ok(overlay[n.id], `overlay for ${n.id}`)
  assertNoKeyInOverlay(overlay)
})

test('htmlToCards: method lesson anchors', () => {
  const { cards } = htmlToCards({ html: fx('math-s3-05'), genre: '方法课', id: 'math-s3-05' })
  assert.deepEqual(cards.map((c) => c.anchor), ['motivation', 'explain', 'examples', 'connections', 'oral'])
})

test('htmlToCards: 练习课 → single motivation card, no read-check required', () => {
  const { cards, overlay } = htmlToCards({ html: fx('math-s2-08'), genre: '练习课', id: 'math-s2-08' })
  assert.deepEqual(cards.map((c) => c.anchor), ['motivation'])
  // validateContent passes for a 练习课 with no read-check (substantial set is empty)
  const problems = validateContent({ content: { cards }, overlay, genre: '练习课', id: 'math-s2-08' })
  assert.deepEqual(problems, [], problems.join('\n'))
})

test('content+read-checks pass validateContent for a concept lesson', () => {
  const { cards, overlay } = htmlToCards({ html: fx('math-s2-03'), genre: '概念课', id: 'math-s2-03' })
  // author 2 trivial read-checks per substantial card
  const byAnchor = {}
  for (const a of ['motivation', 'model', 'anatomy', 'boundary', 'connections']) {
    byAnchor[a] = [
      { mode: 'choice', prompt: `${a} q1`, options: ['A', 'B', 'C', 'D'], correct_index: 0 },
      { mode: 'input', prompt: `${a} q2`, accept: ['x'] },
    ]
  }
  mergeReadChecks({ cards, overlay, byAnchor })
  const problems = validateContent({ content: { cards }, overlay, genre: '概念课', id: 'math-s2-03' })
  assert.deepEqual(problems, [], problems.join('\n'))
  // >=2 read-checks on every substantial card
  for (const c of cards) if (['motivation', 'model', 'anatomy', 'boundary', 'connections'].includes(c.anchor)) assert.ok(c.read_check.length >= 2)
  assertNoKeyInOverlay(overlay)
})

test('deckToExercises: choice rows → items with key.correct_index only, ords contiguous, no KEY in overlay', () => {
  const rows = [
    { ord: 1, type: '辨认', answer_mode: 'choice', options: ['2', '3', '4', '1'], correct_index: 1, accept: null, layer: '指认', review_of: null, prompt: 'p1', answer: 'expl1' },
    { ord: 2, type: '说理', answer_mode: 'choice', options: ['a', 'b', 'c', 'd'], correct_index: 2, accept: null, layer: '说理', review_of: null, prompt: 'p2', answer: 'expl2' },
    { ord: 3, type: '复习', answer_mode: 'choice', options: ['a', 'b', 'c', 'd'], correct_index: 0, accept: null, layer: '复习', review_of: '项', prompt: 'p3', answer: 'expl3' },
  ]
  const { exercises, overlay } = deckToExercises({ rows, id: 'math-s2-03' })
  assert.equal(exercises.items.length, 3)
  assert.deepEqual(exercises.items.map((i) => i.ord), [1, 2, 3])
  for (const it of exercises.items) {
    assert.deepEqual(Object.keys(it.key), ['correct_index'], `${it.id} key is correct_index only`)
    assert.ok(overlay[it.id], 'prompt in overlay')
    for (const o of it.options) assert.ok(overlay[o], 'option in overlay')
  }
  assert.equal(exercises.items[2].review_of, '项')
  assert.equal(exercises.items[0].review_of, null)
  assertNoKeyInOverlay(overlay) // explanation text (answer) must NOT appear in overlay
  // and the explanation is genuinely not carried anywhere in the exercises JSONB
  assert.ok(!JSON.stringify(exercises).includes('expl1'))
})
