# IntentMill Plan

## Source Contract

`im-spec.md` is the only requirement contract. This express plan mechanically routes its two acceptance criteria through two implementation and verification slices.

## Implementation Approach

Extend the existing edition layout normalizer and validator to recognize both half-width and full-width numeric subpart markers, normalize every complete 1..N sequence to natural order with one item per line, update all currently generated 5m modern-edition exercise documents through that same function, finalize them, and publish all generated lessons through the canonical publisher.

Use existing application boundaries for the UI work: initialize MathLive in the existing More layout; derive the wrong-answer summary server-side from the existing mistake and answer-event tables; render the summary on the authenticated `/learn` page with existing card tokens; and keep the topbar in normal flex flow while making it sticky inside the detail pane and adding mobile safe-area/bottom reachability spacing.

## Phases

1. **Generated exercise and answer-control contract**
   - Reproduce and fix the full-width marker bypass in the edition normalizer.
   - Add deterministic validation and a full 5m audit command that fails on wrong order or missing line breaks.
   - Normalize, finalize, render as needed, and publish every currently generated 5m lesson.
   - Change the math keyboard initial mode to More.
   - Run the focused generator tests and acceptance script assertions for all 5m content and first answer focus.

2. **Mobile shell and app-home summary**
   - Add a server-only corrected/total summary from existing mistake and correct answer facts.
   - Render a linked wrong-answer card on `/learn` using existing design tokens and localized copy.
   - Make the detail topbar sticky without removing its layout space; add mobile safe-area and scroll-bottom protection.
   - Run the ticket Playwright script at desktop and mobile viewports, including an actual wrong-then-correct flow, topbar position, non-occlusion, bottom reachability, summary values, and screenshots.

## Unit Test Plan

- One ticket-scoped Playwright script maps 1:1 to the two acceptance criteria:
  - AC1: run the deterministic full-5m edition audit; open a generated exercise with answer controls, focus the first answer field, and assert More is selected.
  - AC2: at a mobile viewport, verify `/learn` and a textbook page keep the topbar at the viewport top without covering the first content, can scroll the final content fully above the viewport bottom/safe area, and show a wrong-answer card whose corrected/total values change through a real wrong-then-correct submission.
- Focused existing/unit checks cover the edition normalizer and the server-side mistake-summary query contract.
- Run the full app test suite and production build after both slices.

## Handoff Expectations

Record the exact normalized exercise count, published lesson count, database verification, keyboard default, summary semantics, mobile viewport evidence, screenshot paths, tests/build results, and any deviation from this plan. Do not create a PR or deploy in n-im cap6.
