import { describe, expect, it } from 'vitest'
import { projectCards, judgeReadCheck } from '~/lib/reading'

// Fixtures mirror the real JSONB shape (ssot-schemas/db-schemas/stemrobin.sql:222–240):
// neutral content with prose/svg body nodes + read_check items carrying the KEY,
// and a zh overlay mapping every node id to its prose text.
const content = {
  cards: [
    {
      id: 'l-motivation',
      num: 1,
      name: '为什么学这个',
      anchor: 'motivation',
      rev: 1,
      body: [
        { id: 'l-motivation-b0', kind: 'prose', role: 'html' },
        { kind: 'svg', svg: '<svg viewBox="0 0 10 10"></svg>', caption_id: 'l-motivation-cap' },
        { id: 'l-motivation-b1', kind: 'prose', role: 'html' },
      ],
      read_check: [
        {
          id: 'l-motivation-rc0',
          mode: 'choice',
          rev: 1,
          key: { correct_index: 2 },
          options: ['l-motivation-rc0-o0', 'l-motivation-rc0-o1', 'l-motivation-rc0-o2'],
        },
        {
          id: 'l-motivation-rc1',
          mode: 'input',
          rev: 1,
          key: { accept: ['3a', '$3a$'] },
        },
      ],
    },
    { id: 'l-oral', num: 2, name: '概念口试', anchor: 'oral', rev: 1, body: [{ id: 'l-oral-b0', kind: 'prose', role: 'html' }] },
  ],
} as any

const overlay = {
  'l-motivation-b0': { t: '<p>第一段 $a+a=2a$</p>', src_rev: 1 },
  'l-motivation-cap': { t: '图注', src_rev: 1 },
  'l-motivation-b1': { t: '<p>第二段</p>', src_rev: 1 },
  'l-motivation-rc0': { t: '这张卡讲的核心对象是？', src_rev: 1 },
  'l-motivation-rc0-o0': { t: '数字', src_rev: 1 },
  'l-motivation-rc0-o1': { t: '符号', src_rev: 1 },
  'l-motivation-rc0-o2': { t: '字母', src_rev: 1 },
  'l-motivation-rc1': { t: '把 a×3 按约定写成？', src_rev: 1 },
  'l-oral-b0': { t: '<p>口述</p>', src_rev: 1 },
} as any

describe('projectCards — answer-key secrecy (G5)', () => {
  it('never emits key / correct_index / accept anywhere in the payload', () => {
    const cards = projectCards(content, overlay)
    const json = JSON.stringify(cards)
    expect(json).not.toContain('correct_index')
    expect(json).not.toContain('accept')
    expect(json).not.toContain('"key"')
  })

  it('projects read-checks to prompt + resolved options only (no key field)', () => {
    const rc = projectCards(content, overlay)[0].readChecks[0]
    expect(rc).toEqual({
      id: 'l-motivation-rc0',
      mode: 'choice',
      prompt: '这张卡讲的核心对象是？',
      options: ['数字', '符号', '字母'],
    })
    expect('key' in rc).toBe(false)
  })

  it('input read-checks carry no options and no accept list', () => {
    const rc = projectCards(content, overlay)[0].readChecks[1]
    expect(rc.mode).toBe('input')
    expect(rc.options).toBeNull()
    expect(JSON.stringify(rc)).not.toContain('3a')
  })
})

describe('projectCards — body assembly + order + numbering', () => {
  it('keeps card array order and exposes the learner-visible num', () => {
    const cards = projectCards(content, overlay)
    expect(cards.map((c) => c.num)).toEqual([1, 2])
    expect(cards.map((c) => c.anchor)).toEqual(['motivation', 'oral'])
  })

  it('surfaces each card section name (中文名) from card.name (STEMROBIN-35)', () => {
    const cards = projectCards(content, overlay)
    expect(cards.map((c) => c.name)).toEqual(['为什么学这个', '概念口试'])
  })

  it('assembles prose → overlay text and svg → figure.sr-fig + figcaption in body order', () => {
    const html = projectCards(content, overlay)[0].bodyHtml
    expect(html).toBe(
      '<p>第一段 $a+a=2a$</p>\n' +
        '<figure class="sr-fig"><svg viewBox="0 0 10 10"></svg><figcaption>图注</figcaption></figure>\n' +
        '<p>第二段</p>',
    )
  })

  it('a card with no read_check projects an empty readChecks array (auto-pass card)', () => {
    expect(projectCards(content, overlay)[1].readChecks).toEqual([])
  })

  it('fails fast (does not silently emit empty) when an overlay node is missing', () => {
    const holey = { ...overlay }
    delete (holey as any)['l-motivation-b1']
    expect(() => projectCards(content, holey)).toThrow(/overlay missing node/)
  })
})

describe('judgeReadCheck — server-side judging', () => {
  const choice = content.cards[0].read_check[0]
  const input = content.cards[0].read_check[1]

  it('choice: only the correct index judges true', () => {
    expect(judgeReadCheck(choice, { chosen: 2 })).toBe(true)
    expect(judgeReadCheck(choice, { chosen: 0 })).toBe(false)
    expect(judgeReadCheck(choice, {})).toBe(false)
  })

  it('input: accepts normalized-equivalent forms, rejects others', () => {
    expect(judgeReadCheck(input, { text: '3a' })).toBe(true)
    expect(judgeReadCheck(input, { text: ' $3a$ ' })).toBe(true) // whitespace + delimiter forms
    expect(judgeReadCheck(input, { text: 'a3' })).toBe(false)
    expect(judgeReadCheck(input, { text: '' })).toBe(false)
  })
})
