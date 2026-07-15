// Generator proof (no DB): a disposable sample lesson exercises the two updated
// generator code paths that save-lesson.mjs runs — validation (check-content.mjs)
// and render (render-lesson.mjs) — to prove the section display name (中文名) is
// now REQUIRED and EMITTED per card.
// Run: node --test .intentmill/tickets/STEMROBIN-34-restore-titles/tests/generator-sample.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateContent } from '../../../../.agents/skills/sr-math-lesson/scripts/check-content.mjs'
import { renderLessonHtml } from '../../../../.agents/skills/sr-math-lesson/scripts/render-lesson.mjs'

// A disposable 方法课 sample (id math-s99-01), built in-memory and discarded.
const GENRE = '方法课'
const ID = 'math-s99-01'
const NAMES = { motivation: '为什么学这个', explain: '讲解', examples: '例题', connections: '与其他知识点的联系', oral: '概念口试' }
const SUBSTANTIAL = new Set(['motivation', 'explain', 'examples', 'connections'])

function buildSample() {
  const overlay = {}
  const cards = ['motivation', 'explain', 'examples', 'connections', 'oral'].map((anchor, i) => {
    const id = `${ID}-${anchor}`
    const bId = `${id}-b0`
    overlay[bId] = { t: `<p>示例正文 ${anchor}</p>`, src_rev: 1 }
    const card = { id, num: i + 1, name: NAMES[anchor], anchor, rev: 1, body: [{ kind: 'prose', role: 'html', id: bId }], read_check: [] }
    if (SUBSTANTIAL.has(anchor)) {
      const rcId = `${id}-rc0`
      overlay[rcId] = { t: `读一读：关于 ${anchor} 的检查？`, src_rev: 1 }
      const opts = ['A', 'B', 'C', 'D'].map((L, k) => { const oid = `${rcId}-o${k}`; overlay[oid] = { t: `选项 ${L}`, src_rev: 1 }; return oid })
      card.read_check = [{ id: rcId, mode: 'choice', options: opts, key: { correct_index: 0 }, rev: 1 }]
    }
    return card
  })
  return { content: { cards }, overlay }
}

test('sample content with a name on every card passes check-content', () => {
  const { content, overlay } = buildSample()
  const problems = validateContent({ content, overlay, genre: GENRE, id: ID })
  assert.deepEqual(problems, [], `expected no problems, got:\n${problems.join('\n')}`)
})

test('check-content REJECTS a card missing its section name (required going forward)', () => {
  const { content, overlay } = buildSample()
  delete content.cards[1].name // strip 讲解's name
  const problems = validateContent({ content, overlay, genre: GENRE, id: ID })
  assert.ok(problems.some((p) => /name \(section 中文名\) must be a non-empty string/.test(p)), `expected a name problem, got:\n${problems.join('\n')}`)
})

test('render-lesson EMITS each card name in its sr-sec-name label', () => {
  const { content, overlay } = buildSample()
  const meta = { id: ID, subject: 'math', stage: 99, order: 1, title: '样例课', genre: GENRE, theme: '样例', concept: '' }
  const html = renderLessonHtml({ meta, content, exercises: { items: [] }, overlay })
  for (const anchor of Object.keys(NAMES)) {
    assert.ok(html.includes(`<span class="sr-sec-name">${NAMES[anchor]}</span>`), `missing rendered section name for ${anchor}: ${NAMES[anchor]}`)
  }
})

test('render-lesson FAILS FAST when a card has no name', () => {
  const { content, overlay } = buildSample()
  delete content.cards[0].name
  const meta = { id: ID, subject: 'math', stage: 99, order: 1, title: '样例课', genre: GENRE, theme: '样例', concept: '' }
  assert.throws(() => renderLessonHtml({ meta, content, exercises: { items: [] }, overlay }), /missing its section name/)
})
