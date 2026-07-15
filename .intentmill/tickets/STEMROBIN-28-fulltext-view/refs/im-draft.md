# IntentMill Draft

## Source

- Ticket intent: `.intentmill/tickets/STEMROBIN-28-fulltext-view/intent.md` (read in full; raw intent preserved).
- Ticket meta: `.intentmill/tickets/STEMROBIN-28-fulltext-view/meta.json` (read; ticket_key STEMROBIN-28-fulltext-view, story, batch 0005-progress-and-access).
- `AGENTS.md` router + `.prodfarm/charter/` (goal, redlines, engineering-rules, architecture, runbook) — read via intent.md embedded copy and repo. Obeyed: Simplicity First, Surgical Changes, SSOT/one-way, `app/`-only change, no `sr_*` hand-writes, secrets in `.env` never staged.
- Substantive evodocs read (guided the code inspection below):
  - `.evodocs/modules/mod--app--learner-experience.md` — lesson route, CardReader flow, iframe sizing lifecycle, KaTeX contract, 1200px/860px responsive rules, sandbox requirement.
  - `.evodocs/modules/mod--app--domain-services.md` — `getLessonReading` projection, read-check secrecy, `sr_content_answer_events` recording only in `recordReadCheck`, progress not computed at runtime.
- Frontend DESIGN: `resources/reference/DESIGN.md` read. Three-color palette (teal-blue `--sr-blue`, green, white) over neutral ink; `--sr-*` tokens in `app/src/styles/app.css` are the SSOT; buttons: primary solid blue, ghost transparent w/ line border; controls 8px radius; focus = 2px teal-blue outline. No new hues. No existing "segmented control" component — must build from tokens.
- External docs: none needed. No new library/API/SDK/cloud usage — the feature reuses in-repo React 19 + existing iframe pattern + existing reading data. KaTeX is already loaded by the root document (CDN) and used by the existing iframes; reused unchanged.
- `nf-db` / DB: no schema or query change. Verified current lesson inventory read-only (16 lessons `math-s2-01..08`, `math-s3-01..08`, all have `content.cards`, all translated zh+en; `math-s3-07` = 5 cards) to pick a verification target. No write.

## Draft Spec

> DRAFT — not the final contract.

On the lesson page (`app/src/routes/_app/lesson.$id.tsx`), when a lesson has a card tree (`reading` non-null), the learner can switch between two reading modes with an in-page control:

- **逐卡精读 (cards)** — DEFAULT. The existing `CardReader` flow, unchanged: one numbered card at a time, per-card read-check soft gate, STEMROBIN-27 KaTeX rendering of read-check prompts/options, practice-deck unlock after all cards read.
- **全文速览 (fulltext)** — the whole lesson content shown at once: every card's `bodyHtml` concatenated in card order inside ONE sandboxed iframe that reuses `reading.head` (KaTeX + lesson tokens/stylesheet), rendered exactly as the card bodies render today. No read-check UI, no per-card gate, no "done" badge, available immediately without answering anything.

Invariants:
- Full-text mode renders reading content only. It fires NO `recordReadCheck` (no read-check events into `sr_content_answer_events`), so it cannot advance the lesson's "课文进度" (which a later ticket will derive from read-check events).
- Full-text mode does NOT unlock/complete practice via reading: the practice-unlock gate (`allRead`) is driven only by `CardReader.onAllRead`; simply viewing full-text leaves it as-is.
- 逐卡精读 stays byte-for-byte behaviorally identical; the STEMROBIN-27 read-check KaTeX fix stays intact.
- Formulas/figures render in full-text (same iframe head → same KaTeX auto-render + `sr-fig`/`sr-term`/… classes). Mobile (375px): no horizontal overflow (iframe `width:100%; max-width:100%`, same as card frame).
- Lessons with no card tree (fallback full `html`) show no toggle — they already render the whole lesson; behavior unchanged.
- Works logged-out (reading is not login-gated; full-text records nothing regardless of auth).

## Draft Plan

> DRAFT — rough route, refined in cap5.

1. `app/src/lib/reading.ts`: add a small pure exported helper `buildFullTextHtml(head, cards, lang)` that concatenates `cards[].bodyHtml` into the same self-contained srcDoc shell the per-card iframe uses (`<!doctype html>…<head>${head}</head><body><article class="sr-lesson">…</article></body>`). Pure/DB-free so it is unit-testable alongside `projectCards`.
2. `app/src/routes/_app/lesson.$id.tsx`: add a `mode` state (`'cards' | 'fulltext'`, default `'cards'`); render a segmented control (only when `reading` exists) above the reading pane. `cards` → existing `CardReader` (unchanged props). `fulltext` → reuse the existing `LessonFrame` iframe component fed the `buildFullTextHtml(...)` string. Conditional render (mount only the active mode) so each iframe measures its height correctly while visible.
3. `app/src/lib/i18n.ts`: add toggle labels (`read.mode.cards` = 逐卡精读 / Close reading, `read.mode.fulltext` = 全文速览 / Full text, plus an aria group label) for `zh` + `en`.
4. `app/src/styles/app.css`: add `.sr-read-modes` segmented-control styles from existing `--sr-*` tokens (teal-blue selected state, ghost idle, 8px radius, mobile stacking) — no new hue.
5. Unit test `buildFullTextHtml` under `im tests path` (order preserved, all bodies present, no read-check markup, head reused). Browser-verify per playwright rules.

Rejected/needs-decision: keeping both modes mounted with CSS `hidden` (risks display:none iframe `scrollHeight===0` and a body-ResizeObserver that never re-fires on show → collapsed frame); default = fulltext; putting the toggle in the top action bar vs above content. See Assumptions/Grill Required.

## Code And Evodocs Findings

- `getLessonReading` (`app/src/lib/reading.ts:144`) already returns `{ head, cards }` where each `ReadingCard.bodyHtml` is the fully-assembled per-card body (prose overlay text + `figure.sr-fig` svg), and `head` is the lesson's own `<head>` inner HTML (KaTeX links + generated stylesheet). Full-text needs NO new data source — it is `cards.map(c => c.bodyHtml).join('\n')` in the same head shell. Matches evodocs "reuse existing reading data" and charter SSOT (one projection).
- `card-reader.tsx:37 cardSrcDoc(head, bodyHtml, lang)` already wraps one card body in `<article class="sr-lesson">` with the lesson head; the full-text shell is the identical pattern with the concatenated bodies. Evidence the render path is proven for these bodies.
- Read-check recording is isolated to `CardReader.submit → recordReadCheck` (`card-reader.tsx:197`, `reading.ts:177`). It is the ONLY writer of `sr_content_answer_events` with `kind='read_check'`. Full-text mode not mounting `CardReader` ⇒ structurally impossible to record a read-check ⇒ "课文进度 not advanced" holds by construction (matches domain-services evodocs: progress is not computed at runtime; it will derive from these events).
- Practice unlock: `lesson.$id.tsx:44 const [allRead, setAllRead] = useState(!reading)`; set true only by `CardReader onAllRead`. Full-text never calls it, so viewing full-text does not unlock practice — consistent with "no progress from full-text". (evodocs known-limit: overview progress is placeholder; runtime progress not yet derived — so the only progress signal to protect is the read-check event stream.)
- Iframe sizing: both `LessonFrame` (`lesson.$id.tsx:168`) and `CardFrame` measure `contentDocument.body.scrollHeight` on load + 300/1200ms + `ResizeObserver`. A hidden (`display:none`) iframe measures 0 and the body-observer will not re-fire on show → this is why conditional render (fresh mount per active mode) is the safe choice; recorded for the grill.
- `LessonFrame` is reusable as-is (props: `frameRef`, `html`, `title`) — no change needed; full-text can reuse it. Surgical: no refactor of the fallback path.
- DESIGN.md: no segmented-control primitive exists; buttons + tokens are the building blocks. Selected = `--sr-blue`/`blue_tint`+`blue_deep` per catalog-item selected pattern; idle = ghost. No new hue (charter/DESIGN redline).
- Responsive: evodocs notes the 1200px catalog-drawer threshold and an 860px quiz adjustment; the lesson reader already uses `@media (max-width: 860px)`. The toggle will follow the same 860px stacking rule for consistency with `.sr-card-*`.
- No evodocs/code disagreement found; code matches both module docs.

## Assumptions

- Default mode is 逐卡精读 (cards) — preserves the charter's card-based close-reading pedagogy as the primary flow; full-text is the opt-in "速览". (Grill item 1.)
- Toggle lives just above the reading content, inside the scroll pane, rendered only when `reading` exists (so fallback-html lessons and not-ready lessons show nothing new). (Grill item 2.)
- Switching modes may reset `CardReader`'s ephemeral per-visit read state (conditional render remounts it). Acceptable: read progress here is per-visit local UI state, not persistent; no acceptance criterion requires preserving mid-read card state across a toggle, and full-text carries no progress to lose. (Grill item 3.)
- Practice stays locked while in / after full-text unless the learner actually completes 逐卡精读 — consistent with "full-text does not advance progress". Not a regression vs `main` (the toggle is new). (Grill item 3.)
- Full-text keeps the sandboxed-iframe render (not raw in-app DOM) to preserve the lesson's self-contained styling + KaTeX exactly as cards render, honoring the evodocs "lesson HTML stays sandboxed" constraint.

## Risks

- Hidden-iframe height collapse if both modes were kept mounted — mitigated by conditional render (mount active mode only). Named so cap6 does not "optimize" into the hidden-mount trap.
- KaTeX in full-text: relies on the reused `head` running the CDN auto-render inside the iframe (same as cards today). Must browser-verify `.katex` present in full-text, not assume.
- Very long lessons (all cards at once) make a tall iframe; must confirm no horizontal overflow at 375px and that the existing `ResizeObserver` sizing keeps up (same lifecycle as fallback full-html, which already ships).
- Regression risk to 逐卡精读 / STEMROBIN-27 KaTeX fix if the CardReader render branch is disturbed — mitigation: leave `CardReader` and its props untouched; only wrap the branch in the mode switch. Browser-verify formulas still render after toggling back.
- `LessonFrame` is currently a private function in `lesson.$id.tsx`; reusing it in the same file needs no export. Keep it in-file (no cross-module move) to stay surgical.

## Grill Required

completed
