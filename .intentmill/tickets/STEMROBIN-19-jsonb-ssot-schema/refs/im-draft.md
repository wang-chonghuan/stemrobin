# IntentMill Draft

## Source

- ticket key: `STEMROBIN-19-jsonb-ssot-schema`
- ticket id: `STEMROBIN-19`
- `meta.json` read (ticket worktree `.intentmill/tickets/STEMROBIN-19-jsonb-ssot-schema/meta.json`); `worktree_path` confirmed as the current cwd.
- `intent.md` read as the raw original user input (delivery ticket full text + live charter + evodocs modules).
- `AGENTS.md` read (thin router → charter + evodocs + DESIGN).
- `.prodfarm/charter/` read via the charter injected verbatim into `intent.md`: `goal.md`, `redlines.md`, `engineering-rules.md`, `architecture.md`, `runbook.md`.
- `.evodocs/modules/` read (injected into `intent.md`): `mod--database-schema.md`, `mod--app--domain-services.md`, `mod--content-generation--math-courseware.md`. These are substantive and were used to map the existing DB contract and the answer-key-secrecy invariant. No evodocs/code disagreement found; where they differ from the target design the code + SSOT DDL are treated as authoritative for current state.
- Binding design docs read (main checkout, referenced by the ticket): `.tmp/seed-drafts.md` (架构定调 G1/G5/G8 + 草案 1) and `.tmp/plan-card-reading.md` (v0.4 PIVOT + §11 干净设计原则). Note: `plan-card-reading.md §3`'s relational card tables (`sr_lesson_cards`, `sr_lesson_card_i18n`, …) are **explicitly deprecated** by the v0.4 header; the JSONB model in `seed-drafts.md` is the authority.
- Code areas inspected:
  - `ssot-schemas/db-schemas/stemrobin.sql` — the DDL SSOT (9 tables: `sr_users`, `sr_lessons`, `sr_questions`, `sr_answer_events`, `sr_quiz_attempts`, `sr_stories`, `sr_story_chapters`, `sr_story_questions`, `sr_story_answer_events`).
  - `app/src/lib/db.ts` — the single server-only `sql()` client, `search_path="stemrobin-schema"`, `ssl:require`.
  - `app/src/lib/quiz.ts` — the KEY-secrecy read/record contract (`getLessonQuestions` selects only `id,ord,type,prompt,answer_mode,options`; `recordAnswer` loads `correct_index/answer/accept` server-side only after login).
  - `.agents/skills/sr-math-lesson/scripts/save-lesson.mjs` — section anchors `ANCHORS`（概念课: motivation/model/anatomy/boundary/connections/oral; 方法课: motivation/explain/examples/connections/oral; 练习课: motivation）and the `data-sr-section` / `sr-sec-num` numbered card structure; `practice` section is deck-injected (not 課文).
  - `resources/content/math-ledger/stage-3.json` — the ledger JSONB shape (`subject/stage/theme/model/assumed[]/lessons[]` with `id/order/title/genre/status/core_idea/introduces[]/consumes[]/boundary_cases[]`).
- External docs / `find-docs` / Context7: none fetched — no new external library/SDK/cloud interface is introduced. The only technology is PostgreSQL JSONB, already the established stack (`postgres` client via `db.ts`). Recorded as an explicit "no external interface" finding.
- Database usage: read-only live inspection of the shared Azure Postgres (`stemrobin-schema`) via the runbook `psql "$EASYAPP_DATABASE_URL"` path (the repo's canonical server-only DB path; there is no `nf-db` skill in this repo — the charter runbook defines psql as the DB access method). No writes performed in cap3. Findings: 16 `sr_lessons`, 331 `sr_questions`, 25 `sr_answer_events`, and **2** `sr_users` rows (`edwinbiz@hotmail.com` = primary learner; `edwinbiz+clerk_test@hotmail.com` = test account per user memory).
- Frontend `DESIGN.md`: not applicable — this ticket is schema-only (DDL) with no user-visible surface. Recorded as "no UI change".

## Draft Spec

Intent: establish the DB-JSONB content SSOT **data structure** (DDL only) in `ssot-schemas/db-schemas/stemrobin.sql`, applied additively to the shared Postgres, so later tickets (STEMROBIN-20..24) can populate/generate/migrate/read it. This ticket delivers **only the DB structure** — no generator, no migration of existing content, no reading UI, no translation.

Scope (what must be true after delivery):

- **Neutral base content JSONB (SSOT, KEY-bearing, language-neutral).** A per-lesson home for two neutral JSONB documents:
  - `content` — an ordered **card tree**: each substantive card is a first-class node with a stable `id`, a learner-visible 编号 (card number), its section `anchor`, an ordered body of neutral nodes (KaTeX formulas / inline SVG / node-ids), and its own `read_check[]` items. Each read-check item carries its answer **KEY** (`correct_index` for choice, `accept[]` for input) in this neutral document.
  - `exercises` — the practice **deck**: an ordered list of items, each with a stable `id`, cognitive `type`, `answer_mode` (choice/input/work), `layer`, optional `review_of`, and its **KEY** (`correct_index` / `accept[]` / reference `answer`).
  - Prose text is **not** stored in the neutral base; only node-ids, order, 编号, formulas, SVG, and KEY. Formulas/SVG/numeric literals are language-neutral and stored once.
- **Per-locale text overlay JSONB.** One overlay per `(lesson, locale)` mapping `node_id → { text, src_rev }`, covering every translatable prose node: card body prose, section names, read-check prompts/options, exercise prompts/options/explanations. `zh` is the **source** locale and is itself an overlay (it defines the source text); non-source locales record the source revision (`src_rev`) they were translated from, for staleness detection. The overlay **never** contains any KEY.
- **Per-stage ledger JSONB.** A per-`(subject, stage)` home for the concept ledger document (theme/model/assumed/lessons…), so the ledger is authoritative in the DB rather than in `resources/content/math-ledger/*.json`. Ledger is authoring metadata (source `zh`), not part of the learner i18n overlay.
- **Card / exercise answer-event storage.** A home for read-check answer events and JSONB-exercise answer events, keyed by `(user_id, lesson_id, node_id)` with a `kind` discriminator. This data is disposable (authorized by seed G3/D12); it holds no FK to a relational question row because JSONB items have no row identity — their `node_id` is their identity.

Compatibility / non-scope:

- **Additive only.** Existing tables (`sr_lessons`, `sr_questions`, `sr_answer_events`, `sr_quiz_attempts`, story tables, `sr_users`) are not dropped or altered destructively; the app keeps reading them until later tickets migrate/retire them. `sr_questions`/`sr_answer_events` (legacy relational deck) stay untouched this ticket.
- **`sr_users` untouched** — no DDL statement references it except its pre-existing definition; both existing credential rows remain intact.
- No generator rebuild, no content migration, no reading-flow UI, no translation, no app read/write code — those are STEMROBIN-20..24.
- No new dependency, no new recurring cost, no second DB client, no bypass of `search_path="stemrobin-schema"`.

Acceptance (from ticket):

1. `psql` can query the JSONB structures carrying: per-stage ledger; per-lesson card-tree content + exercise deck; per-locale text overlay; card + exercise answer events.
2. For any question-type content, the answer KEY is in a location **distinguishable** from its translatable text (KEY not in any locale overlay).
3. The existing user(s) can still log in — the `sr_users` credential row(s) are intact.

## Draft Plan

Rough direction (schema-only; DDL appended to the one SSOT file):

- Append to `ssot-schemas/db-schemas/stemrobin.sql`, reusing the existing idempotent style (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) so re-applying is safe on the shared DB.
- Candidate structures (names/placement to be finalized in cap5 after grill classification):
  - **Neutral base content:** extend `sr_lessons` with `content JSONB` + `exercises JSONB` (nullable, additive; existing 16 rows get NULL until a later migration ticket populates them). Reuse-first: the lesson identity row already exists; `html`/`pdf` stay as derived caches (commented as derived, SSOT = the JSONB). Alternative considered: a dedicated `sr_lesson_content(lesson_id PK, content, exercises)` table — cleaner SSOT/derived separation but an extra table; leaning to the additive-columns option per engineering-rules "reuse existing / simplicity". (Implementation latitude → grill as recommended default.)
  - **Overlay:** `sr_lesson_i18n(lesson_id, locale, overlay JSONB, updated_at, PRIMARY KEY(lesson_id, locale))`, `overlay = { node_id: { text, src_rev } }`, FK `lesson_id → sr_lessons(id) ON DELETE CASCADE`. Prose only; no KEY.
  - **Ledger:** `sr_content_ledger(subject, stage, ledger JSONB, src_rev, updated_at, PRIMARY KEY(subject, stage))`.
  - **Answer events:** `sr_content_answer_events(id, user_id FK→sr_users ON DELETE CASCADE, lesson_id FK→sr_lessons ON DELETE CASCADE, kind CHECK IN('read_check','exercise'), node_id, is_correct, chosen, answer_text, locale, created_at)` + index on `(user_id, lesson_id)`. One table with a `kind` discriminator rather than two parallel tables (both share the same shape) — Simplicity First / one-way. (Implementation latitude → grill as recommended default.)
- **Staleness convention (documented in SQL comments, not DDL-enforced):** each translatable node in `content`/`exercises` carries a per-node `rev`; the overlay's per-node `src_rev` records the base rev it was translated from; stale ⇔ `overlay.src_rev < base.rev` or node absent. DDL cannot enforce internal JSONB shape; the shape is a contract owned by the generator/saver tickets and is documented + demonstrated with sample rows here.
- Test areas (cap6, empirical against the shared DB per runbook):
  - Apply the DDL: `psql "$EASYAPP_DATABASE_URL" -f ssot-schemas/db-schemas/stemrobin.sql` — must succeed and be re-runnable.
  - Insert one throwaway demo lesson's neutral `content`/`exercises` (with KEY) + `zh` and `en` overlays (prose only) + one ledger row + one read-check and one exercise answer event, then run the AC queries: per-stage ledger; per-lesson card-tree + deck; per-locale overlay; answer events. Prove KEY present in neutral base and **absent** from every overlay (query the overlay JSONB for `correct_index`/`accept`/`answer` and expect none). Clean up demo rows (disposable), or keep them clearly namespaced; do not touch real content or `sr_users`.
  - Verify `sr_users` row count/emails unchanged before and after.
  - Run the app unit floor `cd app && npm run test` (vitest) to confirm the additive DDL breaks nothing (the app code is unchanged, so this is a regression guard).
- Leave untouched: all app `src/lib/*` code, content skills, story tables, `sr_questions`/`sr_answer_events`, `sr_users`.

## Code And Evodocs Findings

- **KEY-secrecy invariant is currently a schema + service pattern** (`mod--database-schema.md` "Answer-key secrecy", `app/src/lib/quiz.ts`): keys live in `sr_questions.correct_index/accept/answer`, read only server-side after login. The JSONB design must preserve this: KEY stays in the neutral base JSONB (server strips it before any locale payload), and is structurally isolated from the translatable overlay. The new overlay table gives a hard structural guarantee (KEY simply is not in `sr_lesson_i18n`), stronger than the current same-row-different-column arrangement.
- **Numbered card boundaries already exist** (`save-lesson.mjs` `ANCHORS` + `data-sr-section`/`sr-sec-num`). The card-tree `content` JSONB mirrors these anchors as first-class nodes with `id` + 编号; the deck-injected `practice` section is excluded (it belongs to the exercises layer). This confirms the "课文不变" premise and that a card node maps 1:1 to an existing validated section.
- **Ledger shape confirmed** (`resources/content/math-ledger/stage-3.json`): top keys `subject/stage/theme/model/assumed[]/lessons[]`; each lesson `id/order/title/genre/status/core_idea/introduces[]/consumes[]/boundary_cases[]`. `sr_content_ledger.ledger` stores this document verbatim per `(subject, stage)`.
- **Single DB client + hyphenated schema** (`db.ts`): all access is server-only through `sql()` with `search_path="stemrobin-schema"`. The new DDL uses the same `SET search_path TO "stemrobin-schema"` header already at the top of the SSOT file; no client or schema change needed.
- **DDL is a creation script, not a migration runner** (`mod--database-schema.md` known-limits): re-applying `CREATE ... IF NOT EXISTS` will not add a new column to an already-created table. `sr_lessons` already exists, so new columns must use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (as the file already does for `sr_answer_events.attempt_id`), not rely on the `CREATE TABLE IF NOT EXISTS sr_lessons` block. This is a concrete correctness constraint for cap6.
- **R-UI (user-visible change):** none. Schema-only DDL; no route, control, copy, or displayed data changes. No peer-app research applicable; no existing UI surface is touched or made inconsistent by adding unused JSONB structures. Recorded truthfully as no-UI-impact.
- **R-EXT (new/unfamiliar external interface):** none. PostgreSQL + `postgres` client + psql are the established stack; JSONB is a native Postgres type already used (`sr_questions.options/accept`). No new API/SDK/service. The only external-facing act is applying additive DDL to the **shared** production Postgres — a data-store operation on the existing store, not a new interface. Its side effects (see Risks) are additive-only.

## Assumptions

- **A1 — `zh` is an overlay locale, not inline base prose (CONFIRMED, grill BD1).** Per seed G8 ("ONE text-overlay per locale … Source locale zh") and the enumerated base contents (structure/order/node-ids/formulas/SVG/answer-KEY, no prose), the neutral base is prose-free and every locale including `zh` has a text overlay. Adjudicated from binding intent in `im-grill.md` BD1 — settled, cleanest KEY isolation.
- **A2 — Extend `sr_lessons` with neutral JSONB columns** rather than a new content table. Justified by reuse-first/simplicity; alternative recorded. Implementation latitude, not a product choice.
- **A3 — One `sr_content_answer_events` table with a `kind` discriminator** for both read-check and exercise events (identical shape, disposable data). Implementation latitude.
- **A4 — Ledger is not translated** (authoring metadata, source `zh`, no i18n overlay). Follows G8 ("only prose [learner-facing] is translated").
- **A5 — Legacy `sr_questions`/`sr_answer_events` remain this ticket** (additive; retirement is a later migration ticket). Follows ticket scope + "additive only".
- **A6 — Per-node `rev`/`src_rev` staleness is a documented JSONB convention**, not DDL-enforced (DDL cannot constrain JSONB internals without brittle CHECKs). Low-risk; owned by generator/saver tickets.

## Risks

- **DB/schema (shared production store):** the empirical verification (cap6) applies DDL to the shared Azure Postgres. Mitigation: strictly additive (`CREATE/ADD COLUMN/CREATE INDEX ... IF NOT EXISTS`), no `DROP`/`ALTER TYPE`/destructive change; charter redline #2 (irreversible data ops on the shared schema) is respected because additive DDL neither deletes nor pollutes accumulated data. Demo rows used for AC proof are disposable (authorized) and must be namespaced/cleaned; `sr_users` is never referenced.
- **Correctness — new columns on an existing table:** `sr_lessons` already exists in prod, so `CREATE TABLE IF NOT EXISTS` will not add `content`/`exercises`; must use `ALTER TABLE ADD COLUMN IF NOT EXISTS`. Missing this would silently no-op and fail AC.
- **KEY-isolation contract is JSONB-internal:** DDL guarantees the overlay *table* holds no key column, but "no KEY inside the overlay JSONB blob" is a convention the generator/saver (later tickets) must uphold; this ticket demonstrates it with sample rows and documents it, but cannot DDL-enforce it. Risk noted for downstream tickets.
- **Staleness granularity:** if a coarser (document-level) `src_rev` were chosen instead of per-node, later re-translation would be over-broad. Recording per-node convention now avoids that; low risk since schema stores JSONB either way.
- **R-TEST (dev-time testing obstacles):** cap6 verification is empirical psql against the **shared live DB** (there is no local/disposable Postgres and no `nf-db` skill; the runbook's psql path is the only DB access). Obstacles: (a) must write + clean up throwaway demo rows on a shared store without disturbing real content or `sr_users`; (b) the AC is proven by psql query output, not a unit test, so cap6 must capture query outputs into `im-handoff.md`; (c) `npm run test` (vitest) is only a regression guard (app code unchanged), not a schema test. All are executable with the present `.env` + psql (verified reachable in cap3); no test account/credential is missing.

## Grill Required

completed

All blocking decisions (BD1 `zh`-as-overlay, BD2 additive-DDL-on-shared-DB) are adjudicated from the charter + binding intent in `im-grill.md` with declarative `final_decision` values and reflected in this draft. No grill-leak (no product decision the charter/intent could not settle). Remaining concerns are classified as recommended defaults, future/conditional, or out-of-scope guardrails.
