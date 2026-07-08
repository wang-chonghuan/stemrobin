import { describe, it, expect } from 'vitest'
import { normalizeMathAnswer as n } from './answer-normalize'

// The input-mode judge compares n(typed) against n(each accept form). These
// tests pin the typing variants a child actually produces.
describe('normalizeMathAnswer', () => {
  it('strips whitespace anywhere', () => {
    expect(n(' 3x + 3 ')).toBe('3x+3')
  })
  it('maps full-width chars from Chinese IME to half-width', () => {
    expect(n('３ｘ＋３')).toBe('3x+3')
    expect(n('－１')).toBe('-1')
    expect(n('１／２')).toBe('1/2')
  })
  it('unifies unicode minus signs', () => {
    expect(n('−2y')).toBe('-2y')
    expect(n('–2y')).toBe('-2y')
  })
  it('collapses explicit multiplication next to letters/brackets, keeps digit*digit', () => {
    expect(n('3×x')).toBe('3x')
    expect(n('3·x')).toBe('3x')
    expect(n('8*x')).toBe('8x')
    expect(n('x*y')).toBe('xy')
    expect(n('3*(a+1)')).toBe('3(a+1)')
    expect(n('2*3')).toBe('2*3') // numeric product stays explicit (23 ≠ 6)
  })
  it('turns superscripts into ^n', () => {
    expect(n('x²y')).toBe('x^2y')
    expect(n('x³')).toBe('x^3')
  })
  it('normalizes full-width brackets and trailing 句号', () => {
    expect(n('（a－1）。')).toBe('(a-1)')
  })
  it('judging: typed variants match canonical accept forms', () => {
    const accept = ['5x-2x+3', '3x+3']
    const typed = '５x − 2x ＋ 3' // full-width 5, unicode minus, full-width plus
    expect(accept.some((a) => n(a) === n(typed))).toBe(true)
  })
})
