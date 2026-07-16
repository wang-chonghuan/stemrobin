// STEMROBIN-40 ticket-scoped unit test — pure render invariants of the ONE
// canonical render path (render-lesson.mjs `renderLessonHtml`), which the
// re-render (rerender-lessons.mjs) and the generator (save-lesson.mjs) both use.
//
// Guards the ticket's acceptance at the unit level, independent of the DB:
//   1. every content card renders `sr-sec-num`(序号) + its `sr-sec-name`(中文名);
//   2. the exercises deck renders a styled numbered practice (练习) section;
//   3. the rendered html carries NO answer KEY (correct_index/accept/answer),
//      even when the input deck DOES carry key material (answer-key secrecy).
//   4. renderCard fails fast when a card is missing its section name (中文名).
//
// Run: node --test .intentmill/tickets/STEMROBIN-40-rerender-html/tests/render-invariants.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderLessonHtml } from '../../../../.agents/skills/sr-math-lesson/scripts/render-lesson.mjs'

const meta = { id: 'math-s9-99', subject: 'math', stage: 9, order: 99, title: '样例课', genre: '概念课', theme: '样例主题', concept: '样例核心概念' }
const content = {
  cards: [
    { num: 1, anchor: 'motivation', name: '为什么学这个', body: [{ id: 'm1', role: 'p' }], read_check: [{ id: 'rc1', mode: 'choice', options: ['o1', 'o2'] }] },
    { num: 2, anchor: 'explain', name: '讲解', body: [{ id: 'e1', role: 'p' }, { kind: 'formula', tex: 'a+b' }], read_check: [] },
  ],
}
// The deck DELIBERATELY carries answer-key material to prove it never reaches the html.
const exercises = {
  items: [
    { id: 'q1', ord: 1, type: '识别', mode: 'input', key: { accept: ['3', '三'] } },
    { id: 'q2', ord: 2, type: '辨析', mode: 'choice', options: ['c1', 'c2'], layer: '复习', key: { correct_index: 0 } },
  ],
}
const overlay = {
  m1: { t: '动机段。' }, e1: { t: '讲解段。' },
  rc1: { t: '读检问题？' }, o1: { t: '选项一' }, o2: { t: '选项二' },
  q1: { t: '练习一：求值。' }, q2: { t: '练习二：判断。' }, c1: { t: '对' }, c2: { t: '错' },
}

test('每个 card 渲染序号 + 中文名', () => {
  const html = renderLessonHtml({ meta, content, exercises, overlay })
  for (const c of content.cards) {
    assert.match(html, new RegExp(`<span class="sr-sec-num">${c.num}</span><span class="sr-sec-name">${c.name}</span>`))
  }
})

test('练习区渲染为带样式的编号 section（练习），序号接在正文 section 之后', () => {
  const html = renderLessonHtml({ meta, content, exercises, overlay })
  assert.match(html, /<section data-sr-section="practice">/)
  // practice num = card count + 1 = 3, name 练习
  assert.match(html, /<span class="sr-sec-num">3<\/span><span class="sr-sec-name">练习<\/span>/)
  assert.match(html, /<ol class="sr-practice">/)
  assert.match(html, /<span class="sr-ptype">识别<\/span>/) // per-item type tag styling
})

test('答案 KEY 结构性缺席（correct_index/accept/answer/answer_text 均不出现），即使 deck 携带 key', () => {
  const html = renderLessonHtml({ meta, content, exercises, overlay })
  // input deck DID carry key.accept + key.correct_index; none may reach the html.
  assert.doesNotMatch(html, /correct_index/)
  assert.doesNotMatch(html, /"accept"/)
  assert.doesNotMatch(html, /answer_text/)
  assert.doesNotMatch(html, /<span class="sr-p-opt"><b>A\.<\/b> 三/) // an accept-form value must not appear as an option
})

test('渲染练习选项时只出 prompt+选项，选项文本来自 overlay', () => {
  const html = renderLessonHtml({ meta, content, exercises, overlay })
  assert.match(html, /练习二：判断。/)
  assert.match(html, /<span class="sr-p-opt"><b>A\.<\/b> 对<\/span>/)
  assert.match(html, /<span class="sr-p-opt"><b>B\.<\/b> 错<\/span>/)
})

test('缺少 section 中文名的 card 会 fail-fast', () => {
  const bad = { cards: [{ num: 1, anchor: 'motivation', body: [], read_check: [] }] }
  assert.throws(() => renderLessonHtml({ meta, content: bad, exercises: { items: [] }, overlay: {} }), /missing its section name/)
})
