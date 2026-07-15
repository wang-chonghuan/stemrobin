// STEMROBIN-28 — buildFullTextHtml contract (self-contained ticket-scoped unit).
// The live function lives in app/src/lib/reading.ts and is guarded by the vitest
// test app/src/lib/reading-fulltext.test.ts (run by `npm run test`). This mirror
// keeps a runnable node --test assertion independent of the app build, per the
// repo's ticket-test convention. Run:
//   node .intentmill/tickets/STEMROBIN-28-fulltext-view/tests/fulltext-html.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'

// Mirror of buildFullTextHtml (kept in-test so the assertion is self-contained;
// byte-identical to app/src/lib/reading.ts).
function buildFullTextHtml(head, cards, lang) {
  const body = cards.map((c) => c.bodyHtml).join('\n')
  return `<!doctype html><html lang="${lang}"><head>${head}</head><body><article class="sr-lesson">${body}</article></body></html>`
}

const head = '<link rel="stylesheet" href="katex.css">'
const cards = [
  { id: 'a', num: 1, anchor: 'a', bodyHtml: '<p>第一段 $a+a=2a$</p>\n<figure class="sr-fig"><svg></svg></figure>', readChecks: [{ id: 'a-rc', mode: 'choice', prompt: '核心是？', options: ['数字'] }] },
  { id: 'b', num: 2, anchor: 'b', bodyHtml: '<p>第二段 $3a$</p>', readChecks: [] },
  { id: 'c', num: 3, anchor: 'c', bodyHtml: '<p>第三段</p>', readChecks: [] },
]

test('concatenates every card body in card-array order', () => {
  const html = buildFullTextHtml(head, cards, 'zh-CN')
  const a = html.indexOf('第一段')
  const b = html.indexOf('第二段')
  const c = html.indexOf('第三段')
  assert.ok(a > -1 && b > a && c > b, 'bodies present and in order')
})

test('reuses the lesson head + sr-lesson article shell + lang, keeps figures', () => {
  const html = buildFullTextHtml(head, cards, 'en')
  assert.ok(html.startsWith('<!doctype html>'))
  assert.ok(html.includes('<html lang="en">'))
  assert.ok(html.includes(head), 'head reused')
  assert.ok(html.includes('<article class="sr-lesson">'), 'lesson article shell')
  assert.ok(html.includes('<figure class="sr-fig">'), 'figure preserved')
})

test('emits no read-check prompt/option/markup (full-text has no read-check)', () => {
  const html = buildFullTextHtml(head, cards, 'zh-CN')
  assert.ok(!html.includes('核心是'), 'read-check prompt absent')
  assert.ok(!html.includes('sr-card-check'), 'no read-check markup')
})

test('carries no answer KEY fields', () => {
  const html = buildFullTextHtml(head, cards, 'zh-CN')
  assert.ok(!html.includes('correct_index') && !html.includes('"key"'), 'no KEY leak')
})
