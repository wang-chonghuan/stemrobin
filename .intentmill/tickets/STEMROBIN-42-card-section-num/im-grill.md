# im-grill — STEMROBIN-42 (self-adjudicated, cap13, full delegation, no human)

## G1. Is the current color literally black?
No — code sets `.sr-card-section { color: var(--sr-blue-deep) }` (#0A5E76). The seed premise
"全黑" is a *perception*: a dark desaturated teal at 13px/600 reads as near-black and is not
prominent. Adjudication: the premise is directionally valid (not prominent enough); the fix is
to move to the brighter `--sr-blue` and increase size/weight, which satisfies "明显的颜色、非纯黑"
whether or not the original was literally black. Recorded as a grill-leak (premise wording).

## G2. Where does the number come from? Off-by-one risk?
`card.num` (ReadingCard.num, the section number, 1-based — same value already shown in the
progress "第 {num} / {total} 张卡片"). Use it verbatim; no arithmetic, no off-by-one.

## G3. zh vs en parity?
Number + name are language-neutral. Name is `card.name` (中文名, shared source per charter:
math source language is Chinese, formulas shared cross-language). Both locales render identically.
No i18n key needed → no new translation surface.

## G4. Which accent token — blue or green?
DESIGN palette = teal-blue (primary) + green (mastery/correct) + white. The section title is a
navigational/label accent, not a correctness state → primary teal `--sr-blue`. Green is reserved
for correct/mastery. Choose `--sr-blue`. No new hue.

## G5. Does the lesson title still show / read-check flow intact?
`.sr-card-lesson` (label) is untouched and still rendered above the section. The read-check
components, submit flow, and completion gate are not touched. Verified black-box in gate6.

## G6. Empty name?
`card.name &&` guard retained — if a card has no name, nothing renders (unchanged). The number
is only shown alongside the name (inside the guard), matching "编号 + 中文名".
