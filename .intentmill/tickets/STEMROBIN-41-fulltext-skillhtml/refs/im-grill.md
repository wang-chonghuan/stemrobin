# im-grill — STEMROBIN-41

Full delegation (n-prodfarm cap13, no human): each blocking decision is
self-adjudicated from the charter + seed intent + seed grill and recorded here.

## D1 — Which HTML does 全文速览 render?
- Decision: the stored skill-produced `sr_lessons.html` via `getLessonHtml(id)`,
  rendered verbatim in the existing sandboxed `LessonFrame` iframe.
- Adjudication: seed scope + G-A explicitly require 速览 to match the PDF, and the
  PDF and `sr_lessons.html` are the same `render-lesson.mjs` output (STEMROBIN-40).
  Charter engineering-rule 5 (SSOT / one way): a single full-text source beats two
  renderers. Confirmed.

## D2 — Keep or remove `buildFullTextHtml` (+ helpers)?
- Decision: remove `buildFullTextHtml`, `exercisesHtml`, `escapeHtml`,
  `FullTextExtras`, `FullTextQuestion`, delete `reading-fulltext.test.ts`, remove the
  orphaned `read.exercises` i18n key.
- Adjudication: seed G-A ("one renderer, not two") + engineering-rule 3 (remove code
  your change orphaned). `projectCards` stays covered by `reading.test.ts`. Confirmed.

## D3 — 课后题 in 速览: display-only vs interactive?
- Decision: display-only (no scoring, no progress, no server call).
- Adjudication: seed grill G-3. The stored html's 练习 section is prompt+options only
  (no KEY) and carries no interactive controls, so display-only is automatic — no
  extra client suppression needed. Verified in-browser (buttons/inputs/forms = 0,
  no correct_index/accept leak). Confirmed.

## D4 — Loader shape: always fetch `html`?
- Decision: always `html = getLessonHtml(id)`; drop the 速览-only `questions` fetch;
  keep `getLessonReading` (card view) and the QuizDrawer's own `getLessonQuestions`.
- Adjudication: 速览 now needs `html` whenever a card tree exists, and `html` is still
  the no-card-tree fallback — one fetch serves both. The `questions` loader field fed
  only `buildFullTextHtml`; the practice drawer is untouched. Confirmed.

## Recommended defaults (applied)
- Null-`html` guard in the 速览 branch → the existing `lesson.notReady` text
  (defensive; a card-tree lesson always has html).

## Future / conditional
- If a future lesson family stores full html without a card tree AND wants a
  card/full toggle, the toggle currently only appears when `reading != null`; out of
  scope here.

## Out of scope (guardrails)
- No answer keys reintroduced anywhere in 速览.
- 逐卡精读 flow unchanged (STEMROBIN-42 section titles, read-checks, formulas intact).
- Login gate unchanged. No new dependency. Only `app/` changes.
