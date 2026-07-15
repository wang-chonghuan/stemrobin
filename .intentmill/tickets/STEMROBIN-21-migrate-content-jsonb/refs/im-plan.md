# IntentMill Plan

## Source Contract

`im-spec.md` is the source contract. Every step below traces to a spec requirement (R1–R11), a critical existing contract, or a confirmed decision (BD1–BD3). No requirement is added beyond `im-spec.md`.

## Implementation Approach

Build a dedicated, idempotent migration capability under the existing skill, reusing the T2 lower-level pieces (`db.mjs`, `render-lesson.mjs`, `validateContent`, `validateExercises`, `save-ledger.mjs`) — NOT `save-lesson.mjs` (its human-outline gate rejects stage-2). New files:

- `.agents/skills/sr-math-lesson/scripts/migrate-lib.mjs` — PURE (no DB) functions: `splitSectionChildren(innerHtml)` (depth-counting top-level element splitter, no new dependency), `htmlToCards({html, genre, id})` → `{cards, overlay}` (drops `practice`, maps `<figure><svg>`→svg node + caption overlay, every other block→prose `html` node verbatim, assigns stable node ids + `num` from 1), and `deckToExercises({rows, id})` → `{exercises, overlay}` (maps each `sr_questions` row to an item + option/prompt overlay entries).
- `.agents/skills/sr-math-lesson/scripts/migrate-lesson.mjs` — orchestration for one lesson id: read row + `sr_questions`; snapshot original html + questions to the migration output dir; build content/exercises/overlay via `migrate-lib`; merge authored read-checks; run `validateContent` (hard gate) + `validateExercises` (informational log); render html/pdf; upsert `sr_lessons.content/exercises/html/pdf` + `sr_lesson_i18n(zh)`; write the unified diff (original vs re-rendered html). Idempotent (stable ids, on-conflict upsert).
- `.agents/skills/sr-math-lesson/scripts/migrate-all.mjs` — runs ledger migration (`save-ledger.mjs` for stage 2 and 3) then `migrate-lesson` for all 16 ids; prints a summary.
- `.agents/skills/sr-math-lesson/scripts/migrate-lib.test.mjs` — offline unit tests (node's built-in `node:test`) against snapshotted html; no DB.

Read-check authoring (R4): a per-lesson digest of each substantial card's prose is produced by `migrate-lesson` (pass 1, `--emit-digest`); read-checks are authored from that prose (parallel per-lesson authoring by subagents, then one review pass for "tests reading only / answer in-card / well-formed"), returned as JSON keyed by card anchor, and merged in pass 2. The `html` prose role is added to `render-lesson.mjs renderBodyNode` (BD3): a single `if (node.role === 'html') return t` branch; no existing branch touched.

## Implementation Drift Controls

- The migration NEVER routes a lesson through `save-lesson.mjs`; it reuses `validateContent` + `render-lesson.mjs` directly (prevents stage-2 outline-gate rejection while keeping the content structural gate).
- `validateContent` is a HARD pre-write gate per lesson (R11): a lesson that fails (anchor mismatch, empty body, KEY-in-overlay, <2 read-checks after merge) aborts that lesson's write — no partial data.
- The read-check count is asserted ≥2 per substantial card explicitly (spec R4 exceeds `check-content`'s built-in ≥1).
- Answer-key secrecy: `deckToExercises`/read-check builders put `correct_index`/`accept` ONLY in `item.key` (neutral base), never in the overlay; the renderer never emits `key`; a no-KEY-in-html grep runs across all 16 at verify (R6).
- Snapshots of every original `sr_lessons.html` + `sr_questions` are written BEFORE any DB mutation (R8/R9, BD2 envelope). `sr_users` and `sr_questions` are read-only in the migration (R10) — no DELETE/UPDATE targets them.
- `render-lesson.mjs` change is additive only; confirm by diff that no existing role branch changed; re-render a migrated lesson and (if a T2 sample exists) a T2-authored lesson to confirm no regression.
- Idempotency: run one lesson twice and confirm row counts / node ids stable before the batch.

## Phases

1. Renderer extension (BD3): add the `html` prose role to `render-lesson.mjs`. Verify: existing-role output unchanged by inspection; a tiny render smoke test.
2. `migrate-lib.mjs` PURE functions + offline unit tests against snapshotted html (from `.migrate-scratch` dumps). Verify: `node --test` green; splitter round-trips block boundaries; `htmlToCards` yields genre-exact anchors, num 1..N, non-empty bodies; `deckToExercises` yields ord-contiguous items with correct key shape.
3. Ledger migration: `save-ledger.mjs --ledger resources/content/math-ledger/stage-2.json` and `stage-3.json`. Verify: `sr_content_ledger` has 2 rows (R1) via psql.
4. Single-lesson end-to-end on one concept + one method lesson (e.g. `math-s2-03`, `math-s3-05`): snapshot → build → author read-checks → `validateContent` pass → render → upsert → diff. Verify: psql shows content/exercises/overlay; browser renders it (R7).
5. Read-check authoring for all substantial cards across the 15 lessons with substantial cards; review pass. Verify: ≥2 per substantial card asserted by `validateContent` + a count query.
6. Batch run `migrate-all.mjs` for all 16 + both ledgers (idempotent). Verify: empirical verification below (R1–R11) and capture in `im-handoff.md`.

## Unit Test Plan

Offline unit tests in `migrate-lib.test.mjs` (`node:test`, no DB), plus DB/browser verification steps:

- Section splitter: given a section with nested `div.sr-example>div.sr-step`, `figure>svg`, `p`, `ol.sr-oral`, splits into the correct top-level children (no over/under-splitting on nested same-tag). High-risk: nesting depth.
- `htmlToCards`: for a concept-genre html → cards anchors exactly `[motivation,model,anatomy,boundary,connections,oral]`, `num` 1..6, `practice` dropped, every prose node id present in overlay, svg node holds `<svg`, caption in overlay. For a 练习课 html → single `motivation` card, no read_check required. Assert `validateContent` returns no problems for the built content (excluding read-checks, which are added later) — i.e. structural correctness.
- `deckToExercises`: choice rows → items with `mode:'choice'`, `key:{correct_index}` only (no `accept`/`answer` in key), options as node ids resolvable in overlay, ords contiguous, type/layer/review_of preserved; prompt/options text in overlay; NO KEY field in any overlay entry.
- KEY-secrecy assertion: no overlay value produced by either builder contains `correct_index`/`accept`/`answer`.
- Idempotency (integration, gated): running `migrate-lesson` twice on one id leaves stable node ids and a single overlay row (verified by psql, not a unit test — noted because the shared prod DB cannot be spun up disposably).
- Renderer additivity: a render smoke test that the `html` role emits `t` verbatim and a `default` prose node still emits `<p>…</p>` (no regression).

High-risk behaviors that cannot be unit-tested inside `im tests path` (shared prod DB, browser): covered by explicit cap6 verification steps — psql proofs for R1/R2/R4/R5/R6/R10, no-KEY grep for R6, and a browser render of a migrated lesson for R7.

## Handoff Expectations

`im-handoff.md` must record: files added/changed (incl. the one-line `render-lesson.mjs` additive change); the psql proof for all 16 (card counts, ≥2 read-checks per substantial card, exercises item counts, 2 ledger rows); the no-KEY-in-html grep result; confirmation the app renders a migrated lesson; the location of per-lesson snapshots + diffs and any prose adjustments (expected none); confirmation the 2 `sr_users` rows and all `sr_questions` rows are unchanged and the 16 catalog identities preserved; idempotency check result; `validateExercises` informational findings; residual issues / future-ticket handoffs (choice-explanation-in-JSONB, en overlay, card-reading UI, STEMROBIN-17). A `## Blocker` section if any external premise fails. A `## Charter drift` note only if the stack/ops changed (not expected).
