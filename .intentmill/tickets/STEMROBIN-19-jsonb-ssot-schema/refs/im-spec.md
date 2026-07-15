# IntentMill Spec

## Intent

Establish, in the DB schema SSOT `ssot-schemas/db-schemas/stemrobin.sql`, the JSONB-centric content data **structure** that makes the database the single authority for course content: per-stage concept ledger, per-lesson card-tree content and exercise deck, a per-locale text overlay, and card/exercise answer-event storage. This ticket delivers **only the DB structure**, applied additively to the shared Azure Postgres (`stemrobin-schema`). It builds no generator, no content migration, no reading UI, and no translation.

## Scope

- Add DDL to `ssot-schemas/db-schemas/stemrobin.sql` (the single SSOT DDL file, applied via `psql "$EASYAPP_DATABASE_URL" -f ssot-schemas/db-schemas/stemrobin.sql`) for:
  - **Neutral base content per lesson** — two language-neutral, KEY-bearing JSONB documents keyed to lesson identity: `content` (an ordered card tree: each substantive card is a first-class node with a stable `id`, a learner-visible 编号, its section `anchor`, an ordered body of neutral nodes, and its own `read_check[]` items whose answer KEY lives here) and `exercises` (the practice deck: ordered items with stable `id`, `type`, `answer_mode`, `layer`, optional `review_of`, and their answer KEY here).
  - **Per-locale text overlay** — one overlay per `(lesson, locale)` mapping `node_id → { text, src_rev }`, covering all translatable prose (card body prose, section names, read-check prompts/options, exercise prompts/options/explanations). `zh` is the source locale and is itself an overlay. The overlay holds no KEY.
  - **Per-stage ledger** — a per-`(subject, stage)` JSONB home for the concept-ledger document (shape as `resources/content/math-ledger/stage-*.json`).
  - **Card/exercise answer events** — storage for read-check and exercise answer events, keyed by `(user_id, lesson_id, node_id)` with a `kind` discriminator.
- Apply the DDL to the shared Postgres and empirically verify the acceptance criteria with psql, capturing outputs in `im-handoff.md`.

## Non-Scope

- No JSONB-first generator rebuild of `sr-math-lesson` (STEMROBIN-20).
- No migration of the existing 16 lessons or the ledger files into the JSONB structures (STEMROBIN-21); the new columns/tables ship empty/NULL.
- No card-reading UI / per-card gating flow (STEMROBIN-22, seed 草案 4).
- No English translation or translation skill (STEMROBIN-23, seed 草案 5).
- No app read/write code, no server-function changes, no `app/src/lib/*` edits, no story-table changes.
- No consumption of answer events for progress (seed D6, out of scope this batch).
- No retirement/drop of legacy `sr_questions`, `sr_answer_events`, or the derived `sr_lessons.html`/`pdf` columns (a later deliberate migration).
- No second DB client, no `search_path` bypass, no new dependency, no new recurring cost.
- Rejected option (grill BD1): storing `zh` prose inline in the neutral base. Not built.

## Requirements

- R1 — The DDL adds a home for a per-`(subject, stage)` ledger JSONB document, queryable by psql, storing the concept-ledger document verbatim.
- R2 — The DDL adds, per lesson, a neutral `content` JSONB (ordered card tree; each substantive card node has a stable `id`, learner-visible 编号, section `anchor`, ordered neutral body nodes, and its own `read_check[]` items) and a neutral `exercises` JSONB (ordered deck items with stable `id`, `type`, `answer_mode`, `layer`, optional `review_of`). Both are queryable by psql per lesson.
- R3 — For every question-type item (read-check items in `content`, deck items in `exercises`), the answer KEY (`correct_index` for choice, `accept[]` for input, reference `answer` for work) is stored inside the neutral base JSONB — a location structurally distinct from any translatable text.
- R4 — The DDL adds a per-`(lesson, locale)` text-overlay JSONB mapping `node_id → { text, src_rev }` for all translatable prose. `zh` is the source locale, represented as an overlay. The overlay contains no answer KEY. Queryable by psql per locale.
- R5 — `src_rev` on each overlay node records the source revision the translation was made from, enabling staleness detection against the neutral base's per-node `rev`. (The per-node `rev`/`src_rev` shape is a documented JSONB convention demonstrated with sample rows; it is not DDL-enforced.)
- R6 — The DDL adds storage for card read-check answer events and exercise answer events, distinguishable by a `kind` discriminator, keyed to `(user_id, lesson_id, node_id)`, queryable by psql. This data is disposable.
- R7 — All new DDL is strictly additive and idempotent (`CREATE TABLE/INDEX IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`): applying it does not drop, destructively alter, delete, or pollute any existing table or row, and re-applying the SSOT file is safe. New columns on the pre-existing `sr_lessons` table MUST be added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, not a `CREATE TABLE IF NOT EXISTS` block (which no-ops on an existing table).
- R8 — After applying the DDL, both existing `sr_users` credential rows are intact (unchanged count, emails, password hashes); the existing single learner can still log in. No new statement references `sr_users`.
- R9 — Acceptance is proven empirically: after applying the DDL, psql queries demonstrate (a) per-stage ledger, per-lesson card-tree content + exercise deck, per-locale overlay, and card/exercise answer events are all queryable; (b) for a demo item, the KEY is present in the neutral base and absent from every locale overlay; (c) `sr_users` is intact. Outputs captured in `im-handoff.md`. Demo/verification rows are disposable and must not disturb real content or `sr_users`.

## Critical Existing Contracts

- **Answer-key secrecy** (`.evodocs/modules/mod--database-schema.md` "Answer-key secrecy"; `app/src/lib/quiz.ts` `getLessonQuestions`/`recordAnswer`): keys must live where the server can read them but never in a browser-facing initial payload. The JSONB design preserves this by keeping KEY in the neutral base and physically excluding it from the overlay table; runtime KEY-stripping remains a service concern of the later reader ticket. This ticket must not weaken this invariant.
- **Single server-only DB client + hyphenated schema** (`app/src/lib/db.ts`): all access goes through `sql()` with `connection.search_path='"stemrobin-schema"'`. The DDL file's existing `SET search_path TO "stemrobin-schema"` header is reused; no client or schema-selection change is introduced.
- **DDL is a creation script, not a migration runner** (`.evodocs/modules/mod--database-schema.md` known-limits): `CREATE ... IF NOT EXISTS` will not add columns to an already-created table. New `sr_lessons` columns must use `ALTER TABLE ADD COLUMN IF NOT EXISTS`, mirroring the existing `sr_answer_events.attempt_id` pattern already in the file.
- **Foreign-key content lifetime**: existing tables cascade child rows on parent delete. New event/overlay tables use `ON DELETE CASCADE` to `sr_lessons(id)` and `sr_users(user_id)` so they inherit the same clean lifetime and never orphan; this must not alter the lifetime of any existing table.
- **Idempotent, additive apply on the shared production store**: the file is re-applied wholesale by the runbook; every new statement must be safe to re-run and must not touch accumulated data (charter redline #2).

## Confirmed Decisions

- BD1 (from `im-grill.md`): `zh` is a text-overlay locale; the neutral base is prose-free (structure/order/node-ids/编号/formulas/SVG/answer-KEY only). Basis: seed G8. The rejected inline-`zh`-prose option is in Non-Scope.
- BD2 (from `im-grill.md`): applying strictly-additive DDL to the shared production Postgres is authorized without separate sign-off (redline #2 gates only destructive/polluting ops; runbook defines the psql apply path; seed G3/D12 authorizes disposing answer data and requires only `sr_users` preservation; full delegation D11).
- Recommended defaults adopted as the delivery shape (from `im-grill.md`): extend `sr_lessons` with nullable `content`/`exercises` JSONB columns (reuse-first, additive); `sr_lesson_i18n(lesson_id, locale, overlay JSONB, ...)` overlay; `sr_content_ledger(subject, stage, ledger JSONB, ...)`; one `sr_content_answer_events(... kind CHECK IN('read_check','exercise'), node_id, ...)` table; idempotent DDL; per-node `rev`/`src_rev` staleness as a documented JSONB convention; KEY-isolation proven with disposable demo rows.
- Future/conditional (from `im-grill.md`): retiring legacy relational deck + derived html/pdf, populating the structures, consuming events for progress, and story-content parity are all later tickets — not this one.

## Compatibility And Regression Constraints

- No existing table is dropped or destructively altered; `sr_questions`, `sr_answer_events`, `sr_quiz_attempts`, `sr_lessons` (existing columns), and all story tables remain byte-compatible for their current app consumers (`app/src/lib/quiz.ts`, `lessons.ts`, `stories.ts`).
- The 16 existing `sr_lessons` rows remain valid; new JSONB columns are nullable and default to NULL.
- `sr_users` (both rows) is untouched; login continues to work.
- The app code is unchanged, so `cd app && npm run test` (vitest) must still pass as a regression guard after the DDL is applied.

## Open Questions

None.
