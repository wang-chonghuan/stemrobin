# IntentMill Spec

## Intent

Make the DB JSONB the authoritative content for the 16 REAL production math lessons (`math-s2-01..08`, `math-s3-01..08`) and the two stage concept ledgers, WITHOUT re-authoring prose, by reusing the T2 (STEMROBIN-20) generator's render/validate capability. After delivery, each lesson has a card-tree `content` JSONB, an `exercises` deck JSONB, a `zh` prose overlay, and ≥2 read-checks per substantial card; each stage ledger is queryable from `sr_content_ledger`; and the current app iframe reader still renders a migrated lesson from re-rendered HTML.

## Scope

- Migrate `resources/content/math-ledger/stage-2.json` and `stage-3.json` into `sr_content_ledger` via the existing `save-ledger.mjs` (closure-validated). Afterward the local files are no longer the authority.
- For each of the 16 lessons: parse `sr_lessons.html` into `content = {cards:[…]}` keyed by teaching `<section data-sr-section>`, EXCLUDING the deck-injected `practice` section; cards ordered with a learner-visible `num` contiguous from 1; card anchors exactly equal the lesson genre's anchor set (from the ledger).
- Decompose each teaching section into ordered neutral body nodes: `<figure><svg>` → neutral `svg` node (SVG markup shared cross-locale; `<figcaption>` → overlay prose via `caption_id`); every other block element → a prose node whose translatable text lives in the overlay and which renders verbatim.
- Convert each lesson's existing `sr_questions` deck into `exercises = {items:[…]}` per the shipped T1 contract: each item `{id, ord, type, mode, layer, review_of, key, rev}`; choice `key={correct_index}`; prompt + option text into the `zh` overlay by node id.
- Author ≥2 read-checks per SUBSTANTIAL card (概念课: motivation/model/anatomy/boundary/connections; 方法课: motivation/explain/examples/connections; 练习课: none), each a low-difficulty "did you read this card" item (choice or input) whose answer is locatable within the card just read; prompts/options into the overlay, KEY into the neutral base.
- Fill `sr_lesson_i18n(locale='zh')` with all translatable prose (body prose, svg captions, read-check + exercise prompts/options).
- Re-render `sr_lessons.html` + `pdf` FROM the JSONB via `render-lesson.mjs`, and upsert `sr_lessons.content/exercises/html/pdf` + `sr_lesson_i18n(zh)`.
- Add ONE additive prose role `html` to `render-lesson.mjs` so DERIVED HTML reproduces the original block structure (BD3).
- Per lesson: produce an original-HTML snapshot + a unified diff (original vs re-rendered HTML) as an auditable artifact showing prose unchanged / only split-adjusted.

## Non-Scope

- No re-authoring of lesson prose, formulas, examples, or teaching content. Structural extraction only. (All 16 verified to split cleanly on genre anchors; no D10 adjustment is expected. If one were ever needed it is minimal and captured in the diff.)
- No `app/` code change; no card-reading soft-gate UI (seed draft 4); no translation / non-`zh` locale (seed draft 5/6); no consumption of `sr_content_answer_events` progress (D6).
- Do NOT delete or rewrite `sr_questions` rows (the current app quiz reads them). Do NOT extend the T1/T2 `exercises` contract to carry the choice explanation.
- Do NOT fix the stage-2 guide/ledger/outline conflict (STEMROBIN-17); move the ledger data as-is.
- Do NOT touch the 2 `sr_users` rows.

## Requirements

- R1 (ledger): after run, `sr_content_ledger` holds one row per stage (subject=math, stage∈{2,3}) whose `ledger` JSONB equals the migrated file content; lessons render without any local ledger file.
- R2 (content cards): each of the 16 `sr_lessons.content` is `{cards:[…]}` with cards in section order, `num` contiguous from 1, `anchor` set exactly equal to the genre anchor set, no `practice` card, each card `{id,num,anchor,rev,body[]}` with non-empty `body`.
- R3 (body fidelity): body nodes preserve the original teaching content byte-for-byte in substance — prose text (incl. inline `$…$`, `<strong>`, `<span class="sr-term">`) placed in the overlay; SVG markup preserved neutral; no formula/example altered.
- R4 (read-checks): every substantial card carries ≥2 read-check items, each well-formed per mode (choice: options[] node ids + `key.correct_index`; input: `key.accept[]`), prompts/options in overlay, KEY only in neutral base.
- R5 (exercises): each `sr_lessons.exercises` is `{items:[…]}` with items ord-contiguous from 1 mirroring the source deck; type/layer/review_of preserved; choice `key={correct_index}`; prompt+options in overlay.
- R6 (overlay + secrecy): one `sr_lesson_i18n(zh)` row per lesson containing every prose node id used by content+exercises; NO overlay entry contains `correct_index`/`accept`/`answer`; the re-rendered `html` contains no answer KEY.
- R7 (derived render): `sr_lessons.html` + `pdf` are re-rendered from the JSONB; the current app iframe reader renders a migrated lesson correctly (KaTeX typeset, responsive, practice projection present).
- R8 (idempotent): re-running the migration overwrites (stable node ids, on-conflict upsert), does not append duplicates, and preserves each lesson's id/subject/stage/lesson_order.
- R9 (audit): a per-lesson original-HTML snapshot and a unified diff exist and are auditable.
- R10 (preserve): the 2 `sr_users` rows are unchanged; `sr_questions` rows are unchanged.
- R11 (validation gate): every migrated lesson passes `check-content.validateContent` for its genre before its DB write; a lesson that fails to parse cleanly (anchor mismatch, empty body) fails fast rather than writing partial data.

## Critical Existing Contracts

- T1 JSONB CONTENT SSOT (`ssot-schemas/db-schemas/stemrobin.sql`): `content`/`exercises`/`read_check` node shapes; overlay is prose-only `{node_id:{t,src_rev}}`; KEY (`correct_index`/`accept`/`answer`) is neutral-base-only. `sr_content_ledger PK(subject,stage)`; `sr_lesson_i18n PK(lesson_id,locale)`; `sr_content_answer_events` disposable.
- `check-content.validateContent`: card anchors must EXACTLY equal the genre anchor set in order; `num` unique+contiguous from 1; each substantial card ≥1 read_check; overlay KEY-free. This is a hard gate for R2/R4/R6/R11.
- `render-lesson.mjs`: renders cards + a `practice` projection from `exercises` showing prompts+options only (never KEY) — the answer-secrecy contract (R6/R7). Prose `t` emitted raw; option/prompt text resolved from overlay.
- `save-ledger.mjs` runs closure-only (`validateLedger`); it does NOT run the human-outline gate, so stage-2 ledger migration is safe despite STEMROBIN-17.
- `save-lesson.mjs` runs the human-outline fidelity gate for real stages — the migration must NOT route through it (stage-2 would be rejected), while still reusing `validateContent` + `render-lesson.mjs` + `db.mjs`.
- App runtime (`mod--app--domain-services`): reads `sr_lessons.html` into a sandboxed iframe and `sr_questions` for the quiz; catalog availability derives from lesson ids. Preserving ids and keeping `sr_questions` keeps the app working (R7/R10).
- DB access contract (`.agents/skills/sr-math-lesson/scripts/db.mjs`): server-only `postgres` client, `ssl:'require'`, `search_path="stemrobin-schema"`; upsert-on-conflict requires UPDATE on the target tables (established path).

## Confirmed Decisions

- BD1: migrate `exercises` to the shipped T1 contract as-is; do NOT carry the choice explanation (`sr_questions.answer`) into JSONB; retain `sr_questions` untouched so nothing is lost.
- BD2: mutating the 16 shared-prod `sr_lessons` rows + 2 `sr_content_ledger` rows is authorized within a snapshot-first, idempotent, `sr_users`-preserving envelope.
- BD3: add an additive `html` prose role to `render-lesson.mjs` (new role value only; existing branches and T2-authored lessons unaffected).
- Recommended defaults adopted as requirements-adjacent constraints: dedicated migration engine reusing the T2 lower-level pieces (not `save-lesson.mjs`); `validateExercises` run informationally (faithful move, not re-authoring) while `validateContent` is a hard gate; `<figure><svg>`→neutral svg node + caption overlay, all other blocks→prose `html` node verbatim; stable node-id scheme; snapshots+diffs committed under a ticket-visible migration dir.

## Compatibility And Regression Constraints

- The re-rendered `sr_lessons.html` must remain a valid self-contained lesson document that the existing iframe reader renders (KaTeX, responsive, practice projection). Verified in the browser on ≥1 migrated lesson.
- Adding the `html` prose role to `render-lesson.mjs` must not change output for any existing role; the sole shared consumer is the generator/migration render path. If a T2-authored sample lesson is available, re-render it to confirm no regression; otherwise assert additivity by code inspection (no existing branch altered).
- Migration is idempotent and re-runnable; catalog ids/subject/stage/lesson_order unchanged.
- No answer KEY appears in any overlay or in any re-rendered `html` (grep-verified across all 16).
- The 2 `sr_users` rows and all `sr_questions` rows are byte-unchanged by the migration.

## Open Questions

None.
