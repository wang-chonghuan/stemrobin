# IntentMill Grill

> Adjudication mode: prodfarm cap13 self-adjudication under seed STEMROBIN-18 `full delegation` (D11). No human is queried; every blocking decision is resolved from the injected charter (goal/redlines/engineering-rules/architecture), the seed's binding decisions (D1–D15, plan-card-reading §11 clean-design), the shipped T1/T2 contracts, and code facts. A genuine product decision the charter could not settle would be reported as a grill-leak; none was found.

## Blocking Decisions

1.
- id: BD1-choice-explanation-slot
- question: The old decks carry a hidden per-choice explanation (`sr_questions.answer`, post-answer reveal) that has NO field in the shipped T1 `exercises` JSONB contract (choice `key={correct_index}` only, enforced by `check-exercises.validateItemKey`). Preserve it by extending the contract, or migrate to the contract as-shipped?
- recommendation: Do NOT extend the T1/T2 contract. Populate `exercises` exactly per the shipped shape (choice `key={correct_index}`; prompt + option text into the `zh` overlay). Keep the explanation lossless by leaving the `sr_questions` rows in place (the current app quiz still reads them) plus the pre-mutation snapshot. Grounded in: intent "复用生成器…不重新生成课文" + engineering-rule #2/#3 (simplicity/surgical, don't reinvent shipped contracts), acceptance criteria (which require an `exercises` deck but not explanations in it), and `mod--database-schema` (sr_questions remains the deck the app reads).
- final_decision: Migrate to the exercises contract as-shipped; do NOT extend it; retain `sr_questions` untouched so the explanation is not lost. Adjudicated from seed scope (migration-only, reuse T2 contract) + "no app/ change" (app reads sr_questions).

2.
- id: BD2-mutate-shared-prod-16-rows
- question: Migration rewrites `sr_lessons.html` and fills `content`/`exercises`/`sr_lesson_i18n(zh)` for all 16 rows in the SHARED Azure prod Postgres, and writes 2 `sr_content_ledger` rows. Is this authorized, and under what safety envelope?
- recommendation: Proceed. redline #2 forbids destroying/polluting accumulated prod data and #4 forbids editing goal.md, but content rows are the intended migration target and D12 authorizes disposing content-related answer events; the ONLY hard-preserve is the 2 `sr_users` rows. Envelope: snapshot every original `sr_lessons.html` + every lesson's `sr_questions` BEFORE any mutation (reversible), idempotent upsert (stable node ids, on-conflict), preserve each lesson's id/subject/stage/lesson_order, and verify a migrated lesson renders in the app.
- final_decision: Authorized within that envelope. sr_users rows never touched; catalog identity preserved; snapshots taken first; idempotent. Adjudicated from redlines #2/#4 + D12 + intent constraints.

3.
- id: BD3-renderer-html-role
- question: The old lessons contain block markup (`div.sr-step/sr-example/sr-note/sr-pitfall/sr-eg`, `ol.sr-oral`, `ul.sr-links`, `table`) that T2's `render-lesson.mjs renderBodyNode` cannot emit (it only wraps prose in `<p>`/note/pitfall/`<h3>`). May the migration extend T2's shipped renderer so DERIVED HTML reproduces the original structure?
- recommendation: Yes — add ONE additive prose role `html` that emits the node's `t` verbatim (unwrapped). It is backward-compatible (a new role value; existing roles and T2-authored lessons are unaffected) and is the minimal change that lets the re-rendered HTML keep the current iframe reader working without altering teaching content. Grounded in engineering-rule #3 (surgical) + intent "从 JSONB 重新渲染 html/pdf 使现有阅读器仍工作".
- final_decision: Approved — additive `html` prose role only; no change to existing render branches; re-render a check to confirm no regression. Adjudicated from intent (reader must keep working) + surgical-change rule.

## Recommended Defaults

- Dedicated migration engine under `.agents/skills/sr-math-lesson/scripts/` reusing `db.mjs` + `render-lesson.mjs` + `validateContent` + `validateExercises` + `save-ledger.mjs`; it does NOT route through `save-lesson.mjs`, whose human-outline fidelity gate stage-2 fails by known contract conflict (STEMROBIN-17). Follows from code fact + "outline conflict is separate".
- `validateExercises` (composition thresholds + review_of closure) is run INFORMATIONALLY, not as a blocking gate: this is a faithful move of authored decks, not re-authoring. `validateContent` IS a hard gate (it validates the new card-tree structure we build).
- Ledger migration via `save-ledger.mjs --ledger stage-{2,3}.json` (closure-only; the stage-2 ledger passes closure per `mod--content-generation--math-courseware`).
- Node-id scheme: card `id=<lesson>-<anchor>`; body prose `<lesson>-<anchor>-b<i>`; svg caption `<lesson>-<anchor>-cap<i>`; read-check `<lesson>-<anchor>-rc<i>` with options `…-rc<i>-o<k>`; exercise item `<lesson>-ex<ord2>` with options `…-ex<ord2>-o<k>`. Stable across re-runs (idempotent).
- `<figure><svg>` → neutral `svg` body node (SVG markup shared cross-locale per plan §2.1); `<figcaption>` → overlay prose via `caption_id`. All other blocks → prose node role `html` with verbatim outerHTML.
- Leave `sr_questions` intact (BD1); the future card-reader (draft 4) + i18n unification (draft 6) migrate the app off it later.
- Commit per-lesson original-HTML snapshot + unified diff under a ticket-visible migration output dir so the governor can audit (intent requires an auditable diff + snapshot per lesson).
- Unit-test the PURE functions (section splitter, html→nodes, deck→items) offline against snapshotted html; run one lesson end-to-end before the batch of 16.

## Future Or Conditional Decisions

- If a future card-quiz reader needs choice explanations inside the JSONB SSOT, that is a T1/T2 contract change (add an explanation field + KEY-secrecy handling) — a separate ticket, not this migration.
- `en` overlay + translation (seed draft 5), card-reading soft-gate UI (seed draft 4), language switch + per-locale availability (seed draft 6), and progress consumption of `sr_content_answer_events` (D6) are all later batch tickets.
- Reconciling the stage-2 guide/ledger/outline conflict (STEMROBIN-17) is a separate ticket; this migration moves the ledger as-is.

## Out-of-Scope Guardrails

- No change to any `app/` code (settled by intent; the current iframe reader must keep working via consistent re-rendered HTML).
- Do NOT delete or rewrite `sr_questions` rows (BD1; app still reads them).
- Do NOT touch the 2 `sr_users` rows (redline #4-adjacent hard constraint / D12).
- Do NOT fix the stage-2 outline conflict here (STEMROBIN-17).
- No translation / non-`zh` locale content this ticket (only the `zh` source overlay is filled).
- No re-authoring of lesson prose/formulas; structural extraction only (all 16 verified to split cleanly, so no D10 adjustment is expected; if one were needed it stays minimal + diffed).
