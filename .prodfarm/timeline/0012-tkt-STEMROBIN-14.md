---
id: 0012
type: tkt
author: machine
date: 2026-07-14
---

# 0012 tkt STEMROBIN-14

- kind: tkt
- ticket: STEMROBIN-14
- type: fix
- corrects: STEMROBIN-13
- merge_commit: 25f297f (PR #6, squash-merged to main 2026-07-14)
- consumes: []

## Background

STEMROBIN-13 converted all 233 math exercises to choice questions, but the
bulk input/work→choice migration filled distractors with reused meta-label
"误区标签" sentences of a different form than the correct answer, so the answer
was guessable at a glance. The human required every math question to become
single-answer with exactly four options (A/B/C/D) where all three distractors
are plausible, same-form, and traceable to a nameable misconception — and to
tighten the generation rule so future lessons comply.

## Decision

Regenerate the options + correct_index for all 233 questions (prompt, order,
type, layer, review target, and hidden explanation preserved via
`save-lesson.mjs --existing-deck`), and tighten the generation contract from
"≥3 options, no cap" to **exactly 4**, with a same-form/named-misconception
distractor mandate in `check-exercises.mjs`, `save-lesson.mjs`, and the
sr-math-lesson guidance. This reverses STEMROBIN-13's "more than four options
allowed" allowance (45 questions had ≠4 options and were normalised to 4).

Execution used n-prodfarm (ticket) + n-evoprompt (batch review loop): pilot
lesson math-s2-03 proved the option-generation rule, then the remaining 10
lessons were generated per-lesson, each reviewed at the data layer
(correctness, same-form distractors, no giveaways) before being saved to the
production DB. No systematic error surfaced, so the rule (prompt.md rev 1) was
never revised and no artifact-gate rerun was needed.

## Consequences

Production DB: 233 math questions, all `choice`, all exactly 4 options, every
`correct_index` valid; embedded practice HTML + PDF re-rendered for all 11
lessons; math answer events/attempts cleared (0). App runtime unchanged; unit
tests 16/16; live app loads lessons and the 20-card quiz; pre-answer secrecy
holds (the quiz query never selects `correct_index`/`answer`). The
sr-math-lesson rule change merged to main via PR #6 (`25f297f`).
