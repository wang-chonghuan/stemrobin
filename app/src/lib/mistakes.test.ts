import { describe, expect, it } from 'vitest'

import { loadTextbookMistakeSummary } from '~/lib/mistakes'

describe('loadTextbookMistakeSummary', () => {
  it('derives corrected occurrences from later correct exercise events', async () => {
    let statement = ''
    let userId: unknown
    const database = ((strings: TemplateStringsArray, value: unknown) => {
      statement = strings.join('$1')
      userId = value
      return Promise.resolve([{ corrected: 3, total: 5 }])
    }) as Parameters<typeof loadTextbookMistakeSummary>[0]

    await expect(loadTextbookMistakeSummary(database, 42)).resolves.toEqual({
      corrected: 3,
      total: 5,
    })
    expect(userId).toBe(42)
    expect(statement).toContain('from sr_textbook_mistakes mistake')
    expect(statement).toContain('event.created_at > mistake.occurred_at')
    expect(statement).toContain("event.kind = 'exercise'")
    expect(statement).toContain('event.is_correct')
  })
})
