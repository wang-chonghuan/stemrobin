import { describe, expect, it } from 'vitest'
import { buildFullTextHtml, projectCards } from '~/lib/reading'

// STEMROBIN-28 — 全文速览 builder. Full-text shows the WHOLE lesson at once: every
// card's already-assembled bodyHtml concatenated in card order, in the lesson's own
// head shell. It must reuse the head (KaTeX + styles), keep card order, include all
// bodies, and emit NO read-check markup / KEY (it only reads bodyHtml).

const cards = [
  {
    id: 'l-a',
    num: 1,
    anchor: 'a',
    bodyHtml: '<p>第一段 $a+a=2a$</p>\n<figure class="sr-fig"><svg></svg></figure>',
    readChecks: [
      { id: 'l-a-rc0', mode: 'choice' as const, prompt: '核心对象是？', options: ['数字', '字母'] },
    ],
  },
  { id: 'l-b', num: 2, anchor: 'b', bodyHtml: '<p>第二段 $3a$</p>', readChecks: [] },
  { id: 'l-c', num: 3, anchor: 'c', bodyHtml: '<p>第三段</p>', readChecks: [] },
]
const head = '<link rel="stylesheet" href="katex.css"><style>.sr-lesson{}</style>'

describe('buildFullTextHtml — whole-lesson full-text srcDoc', () => {
  it('concatenates every card bodyHtml in card-array order', () => {
    const html = buildFullTextHtml(head, cards, 'zh-CN')
    const iA = html.indexOf('第一段')
    const iB = html.indexOf('第二段')
    const iC = html.indexOf('第三段')
    expect(iA).toBeGreaterThan(-1)
    expect(iB).toBeGreaterThan(iA)
    expect(iC).toBeGreaterThan(iB)
  })

  it('reuses the lesson head and wraps bodies in the sr-lesson article shell with lang', () => {
    const html = buildFullTextHtml(head, cards, 'en')
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain(head)
    expect(html).toContain('<article class="sr-lesson">')
    // figure/svg from a card body survives into full-text
    expect(html).toContain('<figure class="sr-fig">')
  })

  it('emits only body content — no read-check prompt/option/KEY markup', () => {
    const html = buildFullTextHtml(head, cards, 'zh-CN')
    // read-check prompt + option text must NOT appear (full-text has no read-check)
    expect(html).not.toContain('核心对象是')
    expect(html).not.toContain('sr-card-check')
    expect(html).not.toContain('correct_index')
    expect(html).not.toContain('"key"')
  })

  it('renders the same body bytes that projectCards produced (no re-transform)', () => {
    // Full-text is exactly the join of projected bodies — same content as cards.
    const projected = cards.map((c) => c.bodyHtml).join('\n')
    expect(buildFullTextHtml(head, cards, 'zh-CN')).toContain(projected)
  })
})

// Guard: the reading projection still exports and works (untouched by this ticket).
describe('projectCards still intact (regression guard)', () => {
  it('is a function and preserves order for a minimal fixture', () => {
    const content = {
      cards: [
        { id: 'x', num: 1, anchor: 'x', body: [{ id: 'x-b', kind: 'prose', role: 'html' }] },
        { id: 'y', num: 2, anchor: 'y', body: [{ id: 'y-b', kind: 'prose', role: 'html' }] },
      ],
    } as any
    const overlay = { 'x-b': { t: '<p>X</p>', src_rev: 1 }, 'y-b': { t: '<p>Y</p>', src_rev: 1 } } as any
    expect(projectCards(content, overlay).map((c) => c.num)).toEqual([1, 2])
  })
})
