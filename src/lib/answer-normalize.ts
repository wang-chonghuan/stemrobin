// Normalize a typed math answer for comparison (input-mode quiz items).
// BOTH the learner's text and the stored accept forms go through this, so deck
// generators only enumerate genuinely different forms (e.g. term order
// "3+x" vs "x+3"), never typing variants. Pure module — unit-tested.
export function normalizeMathAnswer(s: string): string {
  return s
    .trim()
    // full-width → half-width (！-～ covers digits, letters, operators, brackets)
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-') // unicode minus/dashes → '-'
    .replace(/[×·]/g, '*')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/。$/, '')
    // collapse explicit * into implicit multiplication when a letter/bracket is
    // adjacent (8*x → 8x, x*y → xy, 3*(a+1) → 3(a+1)); keep digit*digit (2*3)
    .replace(/([0-9a-zA-Z)])\*(?=[a-zA-Z(])/g, '$1')
}
