import { describe, expect, it } from 'vitest'
import { buildFullTextHtml, projectCards } from '~/lib/reading'

// STEMROBIN-28/35 — 全文速览 builder. Full-text shows the WHOLE lesson at once in
// the lesson's own head shell. STEMROBIN-35 makes it a traditional-textbook layout:
// the lesson title at the top, each card's section 中文名 (name) as a heading before
// its bodyHtml, and — when provided — the display-only 课后题 list after the text.
// The 课后题 are STATIC (no submit/inputs/buttons/handlers) and KEY-free.

const cards = [
  {
    id: 'l-a',
    num: 1,
    name: '为什么学这个',
    anchor: 'a',
    bodyHtml: '<p>第一段 $a+a=2a$</p>\n<figure class="sr-fig"><svg></svg></figure>',
    readChecks: [
      { id: 'l-a-rc0', mode: 'choice' as const, prompt: '核心对象是？', options: ['数字', '字母'] },
    ],
  },
  { id: 'l-b', num: 2, name: '讲解', anchor: 'b', bodyHtml: '<p>第二段 $3a$</p>', readChecks: [] },
  { id: 'l-c', num: 3, name: '例题', anchor: 'c', bodyHtml: '<p>第三段</p>', readChecks: [] },
]
const head = '<link rel="stylesheet" href="katex.css"><style>.sr-lesson{}</style>'

const questions = [
  { ord: 1, prompt: '$\\frac{x}{4}+\\frac{x}{6}=1$ 里分母是？', answerMode: 'choice' as const, options: ['4 和 6', '只有 x'] },
  { ord: 2, prompt: '用一句话说去分母的道理。', answerMode: 'work' as const, options: null },
]

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

  it('renders each card body verbatim (no re-transform of body bytes)', () => {
    const html = buildFullTextHtml(head, cards, 'zh-CN')
    for (const c of cards) expect(html).toContain(c.bodyHtml)
  })

  it('emits no read-check prompt/option/KEY markup (full-text has no read-check)', () => {
    const html = buildFullTextHtml(head, cards, 'zh-CN')
    expect(html).not.toContain('核心对象是')
    expect(html).not.toContain('sr-card-check')
    expect(html).not.toContain('correct_index')
    expect(html).not.toContain('"key"')
  })
})

describe('buildFullTextHtml — title + section headings (STEMROBIN-35)', () => {
  it('renders the lesson title as an h1 at the top when provided', () => {
    const html = buildFullTextHtml(head, cards, 'zh-CN', { title: '3.7 去分母解方程' })
    expect(html).toContain('<h1 class="sr-fulltext-title">3.7 去分母解方程</h1>')
    // title precedes the first section
    expect(html.indexOf('去分母解方程')).toBeLessThan(html.indexOf('第一段'))
  })

  it('renders each card section name as a heading immediately before its body, in order', () => {
    const html = buildFullTextHtml(head, cards, 'zh-CN', { title: 'T' })
    for (const c of cards) {
      const iName = html.indexOf(c.name)
      const iBody = html.indexOf(c.bodyHtml)
      expect(iName).toBeGreaterThan(-1)
      expect(iName).toBeLessThan(iBody)
    }
    // section order matches card order
    expect(html.indexOf('为什么学这个')).toBeLessThan(html.indexOf('讲解'))
    expect(html.indexOf('讲解')).toBeLessThan(html.indexOf('例题'))
  })

  it('omits the title h1 and a section heading when absent', () => {
    const noName = [{ ...cards[0], name: '' }]
    const html = buildFullTextHtml(head, noName, 'zh-CN')
    expect(html).not.toContain('<h1 class="sr-fulltext-title">')
    expect(html).not.toContain('<h2 class="sr-fulltext-section">')
  })
})

describe('buildFullTextHtml — display-only 课后题 (STEMROBIN-35 / G-3)', () => {
  it('lists each exercise prompt and choice options after the full text', () => {
    const html = buildFullTextHtml(head, cards, 'zh-CN', {
      title: 'T',
      questions,
      exercisesLabel: '课后题',
    })
    expect(html).toContain('<section class="sr-fulltext-exercises">')
    expect(html).toContain('课后题')
    expect(html).toContain('去分母的道理')
    expect(html).toContain('4 和 6')
    expect(html).toContain('只有 x')
    // 课后题 come after the last card body
    expect(html.indexOf('sr-fulltext-exercises')).toBeGreaterThan(html.indexOf('第三段'))
  })

  it('emits NO interactive markup in the 课后题 (not answerable/judged in 速览)', () => {
    const html = buildFullTextHtml(head, cards, 'zh-CN', {
      title: 'T',
      questions,
      exercisesLabel: '课后题',
    })
    expect(html).not.toContain('<button')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('sr-quiz-opt')
  })

  it('never leaks a question KEY into the 课后题 (only prompt + options)', () => {
    const html = buildFullTextHtml(head, cards, 'zh-CN', { questions, exercisesLabel: '课后题' })
    expect(html).not.toContain('correct_index')
    expect(html).not.toContain('accept')
    expect(html).not.toContain('answer')
  })

  it('omits the 课后题 section entirely when no questions are supplied', () => {
    const html = buildFullTextHtml(head, cards, 'zh-CN', { title: 'T' })
    expect(html).not.toContain('sr-fulltext-exercises')
  })
})

// Guard: the reading projection still exports and works.
describe('projectCards still intact (regression guard)', () => {
  it('is a function and preserves order + surfaces name for a minimal fixture', () => {
    const content = {
      cards: [
        { id: 'x', num: 1, name: '甲', anchor: 'x', body: [{ id: 'x-b', kind: 'prose', role: 'html' }] },
        { id: 'y', num: 2, name: '乙', anchor: 'y', body: [{ id: 'y-b', kind: 'prose', role: 'html' }] },
      ],
    } as any
    const overlay = { 'x-b': { t: '<p>X</p>', src_rev: 1 }, 'y-b': { t: '<p>Y</p>', src_rev: 1 } } as any
    const out = projectCards(content, overlay)
    expect(out.map((c) => c.num)).toEqual([1, 2])
    expect(out.map((c) => c.name)).toEqual(['甲', '乙'])
  })
})
