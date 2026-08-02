import { describe, expect, it } from 'vitest'

import { findTextbookBook } from './textbooks'

describe('findTextbookBook', () => {
  it('resolves a card through the textbook shelf authority', () => {
    expect(findTextbookBook('math5-c1-s1-n1')).toBe('5m')
  })

  it('does not infer a book from an unknown card id', () => {
    expect(findTextbookBook('math5-unknown')).toBeNull()
  })
})
