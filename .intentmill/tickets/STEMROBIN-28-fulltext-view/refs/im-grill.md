# IntentMill Grill

> Full-delegation seed (STEMROBIN-26): no human grill. Each blocking decision is
> self-adjudicated from `.prodfarm/charter/` (goal, engineering-rules, DESIGN.md)
> and the ticket acceptance criteria, per n-prodfarm cap13. The authority for each
> `final_decision` is cited inline.

## Blocking Decisions

1.
- id: default-mode
- question: When a lesson with a card tree opens, which reading mode is active by default — 逐卡精读 (cards) or 全文速览 (fulltext)?
- recommendation: Default to 逐卡精读. Charter goal makes card-based close reading with read-check the product's core anti-skim pedagogy ("走完全部卡片才算读完课文"); full-text is the opt-in 速览. Defaulting to fulltext would bypass the pedagogy for every learner on every open.
- final_decision: Default to 逐卡精读 (cards). Full-text is opt-in via the toggle. (Authority: charter/goal.md — card-by-card read-check is the core learning method; ticket keeps 逐卡精读 as the unchanged primary flow.)

2.
- id: toggle-placement-and-form
- question: Where and in what form does the mode switch appear?
- recommendation: A two-option segmented control (逐卡精读 | 全文速览) rendered inside the lesson scroll pane, directly above the reading content, and only when the lesson has a card tree (`reading` non-null). Built from `--sr-*` tokens: selected option = teal-blue (`--sr-blue`/blue_tint+blue_deep, matching the catalog selected-item pattern), idle = ghost; 8px control radius; stacks under the 860px reader breakpoint. Not in the top action bar (that bar holds cross-lesson actions: 返回 / 练习 / PDF), so the reading-mode switch sits with the reading content it governs.
- final_decision: Segmented control above the reading content, shown only when `reading` exists, styled from existing `--sr-*` tokens (teal-blue selected / ghost idle, 8px radius, 860px stacking, no new hue). (Authority: resources/reference/DESIGN.md — three-color palette, token SSOT, selected=blue, ghost buttons; engineering-rules Simplicity/Surgical.)

3.
- id: fulltext-progress-and-practice-isolation
- question: What happens to lesson progress and the practice-unlock gate while/after viewing full-text, and is losing ephemeral card state on toggle acceptable?
- recommendation: Full-text records no read-check event (does not mount `CardReader`, never calls `recordReadCheck`), so it cannot advance "课文进度". It also does not unlock practice — the `allRead` gate is driven only by `CardReader.onAllRead`. Conditional-render (mount only the active mode) may reset `CardReader`'s per-visit local read state on toggle; this is acceptable because that state is ephemeral UI state (not persistent progress), no acceptance criterion requires preserving it, and it avoids the display:none-iframe height-collapse bug from keeping both mounted.
- final_decision: Full-text records nothing and advances neither 课文进度 nor practice-unlock; the gate stays `CardReader`-driven. Modes are conditionally rendered; resetting ephemeral card state on toggle is accepted. (Authority: ticket CRITICAL constraint — full-text records no read-check / does not推进 progress; mod--app--domain-services.md — read-check events are the only progress signal, progress not computed at runtime; engineering-rules Simplicity First.)

4.
- id: fulltext-render-surface
- question: Render full-text as a sandboxed iframe (reusing the lesson head) or as raw in-app DOM?
- recommendation: Sandboxed iframe reusing `reading.head` + the same `<article class="sr-lesson">` shell as the per-card frame, so formulas (KaTeX auto-render inside the iframe) and lesson element classes render identically and mobile stays overflow-free. Raw in-app DOM would need re-plumbing KaTeX/styles into the app document and breaks the evodocs "lesson HTML stays sandboxed" contract.
- final_decision: Sandboxed iframe reusing the lesson head + `sr-lesson` article shell (reuse the existing `LessonFrame` component + a pure `buildFullTextHtml` helper). No PDF embed; no new dependency. (Authority: mod--app--learner-experience.md — lesson HTML must stay in a sandboxed iframe; ticket — reuse reading data / lesson head, do NOT embed a PDF, no new dependency.)

## Recommended Defaults

- Reuse the existing in-file `LessonFrame` iframe component for full-text (private to `lesson.$id.tsx`, no export/move needed) — surgical.
- Add `buildFullTextHtml` as a pure exported function in `app/src/lib/reading.ts` beside `projectCards`/`judgeReadCheck` so it is unit-testable without the DB and shares the single reading projection.
- Localize the two toggle labels + aria group label in `app/src/lib/i18n.ts` for zh and en (parity with existing `card.*`/`lesson.*` keys).
- Full-text `lang` attribute follows the active locale (`en` → `en`, else `zh-CN`), same as `CardFrame`.

## Future Or Conditional Decisions

- A later ticket derives "课文进度 complete" from read-check events; this ticket must not fire any read-check in full-text so that derivation stays correct.
- Login gate for reading is handled by a separate seed ticket; this ticket verifies logged-out reading (including full-text) works and records nothing.
- If a future design wants full-text to preserve in-progress card state across toggles, revisit the conditional-render decision (would need state lifting or a sizing-safe hidden-mount).

## Out-of-Scope Guardrails

- No schema change, no new `sr_*` writes, no change to `recordReadCheck` / `sr_content_answer_events`.
- No change to 逐卡精读 behavior or the STEMROBIN-27 read-check KaTeX fix; the `CardReader` component and its props stay untouched.
- No change to the fallback full-`html` lesson path or the quiz/practice drawer.
- `app/`-only change; no content regeneration, no PDF file embedding, no new dependency.
- No new color hue; palette stays teal-blue/green/white per DESIGN.md.
