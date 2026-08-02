import { describe, expect, it } from 'vitest'

import { judgeTextbookPart } from './textbook-answer'

describe('judgeTextbookPart', () => {
  it('accepts equivalent numeric forms', async () => {
    await expect(
      judgeTextbookPart(
        { judge: 'numeric', expected: ['0.75'], unit: '' },
        '\\frac{3}{4}',
      ),
    ).resolves.toBe(true)
  })

  it('accepts displayed percent and degree units', async () => {
    await expect(
      judgeTextbookPart(
        { judge: 'numeric', expected: ['66.7'], unit: '%', tolerance: 0.1 },
        '66.7\\%',
      ),
    ).resolves.toBe(true)
    await expect(
      judgeTextbookPart(
        { judge: 'numeric', expected: ['60'], unit: '°' },
        '60^{\\circ}',
      ),
    ).resolves.toBe(true)
  })

  it('uses configured numeric tolerance', async () => {
    await expect(
      judgeTextbookPart(
        { judge: 'numeric', expected: ['18000'], tolerance: 500 },
        '17847',
      ),
    ).resolves.toBe(true)
  })

  it('accepts algebraically equivalent expressions', async () => {
    await expect(
      judgeTextbookPart(
        { judge: 'expression', expected: ['(x+1)^2'] },
        'x^2+2x+1',
      ),
    ).resolves.toBe(true)
  })

  it('normalizes exact-answer typography', async () => {
    await expect(
      judgeTextbookPart(
        { judge: 'exact', expected: ['3*x'] },
        '３ × x',
      ),
    ).resolves.toBe(true)
  })

  it('rejects a different value', async () => {
    await expect(
      judgeTextbookPart({ judge: 'numeric', expected: ['18'] }, '17'),
    ).resolves.toBe(false)
  })
})
