import { describe, expect, it } from 'vitest'

import { visualViewportVariables } from './visual-viewport'

describe('visualViewportVariables', () => {
  it('keeps a mobile shell aligned with a panned visual viewport', () => {
    expect(
      visualViewportVariables({
        offsetLeft: 0,
        offsetTop: 64,
        width: 390,
        height: 430,
      }),
    ).toEqual({
      '--sr-visual-left': '0px',
      '--sr-visual-top': '64px',
      '--sr-visual-width': '390px',
      '--sr-visual-height': '430px',
    })
  })

  it('rejects negative offsets and unusable dimensions', () => {
    expect(
      visualViewportVariables({
        offsetLeft: -4,
        offsetTop: Number.NaN,
        width: 0,
        height: Number.NEGATIVE_INFINITY,
      }),
    ).toEqual({
      '--sr-visual-left': '0px',
      '--sr-visual-top': '0px',
      '--sr-visual-width': '1px',
      '--sr-visual-height': '1px',
    })
  })
})
