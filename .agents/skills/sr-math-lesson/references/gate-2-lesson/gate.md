# Gate 2 — 課文 HTML

Run after cap2, before cap3/cap4. An independent reviewer receives the HTML, ledger JSON, and contract. For a group, one reviewer may assess every page, but must give each lesson its own Pass/Fail verdict and findings.

## First cause

After reading this, can the learner (a) point at an instance and name its parts, (b) do the move, (c) say WHY the move is legal? A text that only enables (b) fails — that is exactly the failure this skill replaces.

## Checks (fail on any)

- **Vocabulary breach**: a technical term used that is neither in this lesson's `introduces` (and actually taught here) nor in earlier `introduces`/`assumed`. Grep known later-lesson terms mechanically; hunt wild jargon by reading.
- **Definition without instances**: an introduced term lacking 正例+反例 (`.sr-eg`) or never applied to a concrete expression in `anatomy`/`examples`.
- **Boundary cases missing**: any ledger `boundary_cases` entry not honestly taught.
- **Procedure without principle** (方法课): the move stated as recipe with no derivation the learner could re-give.
- **Model absent** (概念课): no structural diagram/parse-through; or the stage model is never used to define the term.
- **Section shape**: wrong/missing anchors for the genre; leftover `{{}}`; missing template structure or DESIGN tokens; an embedded `practice` section (retired).
- **Tone**: lecture paragraphs with no instances; encouragement filler; cartoon metaphors that must later be unlearned; dumbed-down evasion of the real idea.
- **Oral quiz weak**: fewer than 4 items, or answers visible, or questions answerable without the lesson's concept (pure recall of phrasing).

## Scope Limit

This is the deep content gate. Do not spend time on full browser, PDF, or mobile QA here unless a static reading identifies a specific rendering risk. Those observations belong to one final cap4 browser pass after the complete lesson and deck have been saved.

## Pass

Speakable language only; every new term instantiated and boundary-tested; moves derived, not decreed; shape clean. Then cap3/cap4 may proceed.
