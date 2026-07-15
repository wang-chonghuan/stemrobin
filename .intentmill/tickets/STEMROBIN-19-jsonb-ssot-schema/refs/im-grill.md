# IntentMill Grill

> Adjudication note: this batch runs in **full delegation** (seed STEMROBIN-18, D11). No human
> is available; per prodfarm cap13 discipline the executor rules each blocking decision from
> `.prodfarm/charter/` + the ticket spec + the binding design docs (`.tmp/seed-drafts.md`,
> `.tmp/plan-card-reading.md`) and records the ruling and its basis in `final_decision`.
> A decision is escalated as a grill-leak (left `TBD` with a STOP report) ONLY if it is a genuine
> product choice the charter/intent cannot settle. None were found.

## Blocking Decisions

1.
- id: BD1-zh-is-overlay-not-base-prose
- question: Does the neutral base JSONB hold `zh` prose inline, or is `zh` a text-overlay locale like every other language, leaving the base prose-free (structure/order/node-ids/编号/formulas/SVG/KEY only)?
- recommendation: Treat `zh` as a text-overlay locale; the neutral base is prose-free. This is the literal reading of seed G8 and gives the strongest KEY isolation (KEY separated even from source prose).
- final_decision: `zh` is a text-overlay locale; the neutral base carries no prose. Basis: `.tmp/seed-drafts.md` G8 enumerates the neutral base as "structure/order/node-ids/formulas/SVG/answer-KEY" (prose absent) and mandates "ONE text-overlay per locale … Source locale zh"; `.tmp/plan-card-reading.md` §11 principles 3 and 6 require formulas/SVG/KEY stored once and never mixing KEY with prose. Settled by binding intent — not a product grill-leak.

2.
- id: BD2-additive-ddl-on-shared-prod-db
- question: May this ticket apply its DDL to the shared production Azure Postgres (`stemrobin-schema`) without separate human sign-off, given charter redline #2 on the shared schema?
- recommendation: Yes, for strictly-additive DDL only (`CREATE TABLE/INDEX IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`); no `DROP`/destructive `ALTER`; demo-verification rows are disposable and namespaced; `sr_users` is never referenced.
- final_decision: Authorized for additive-only DDL. Basis: `.prodfarm/charter/redlines.md` #2 gates "deleting or polluting accumulated production data" — additive CREATE/ADD-COLUMN/CREATE-INDEX DDL neither deletes nor pollutes existing rows; `.prodfarm/charter/runbook.md` defines `psql "$EASYAPP_DATABASE_URL" -f ssot-schemas/db-schemas/stemrobin.sql` as the canonical apply path; seed G3/D12 explicitly authorizes discarding answer-event data and requires only that the `sr_users` credential row(s) be preserved (this ticket references `sr_users` in no new statement); full delegation (D11) closes release-mode sign-off. Settled by charter — not a grill-leak.

## Recommended Defaults

- Neutral base placement: extend `sr_lessons` with nullable `content JSONB` + `exercises JSONB` columns (additive; existing 16 rows stay valid with NULL until a later migration ticket populates them) rather than a new `sr_lesson_content` table. Basis: engineering-rules "reuse existing … before introducing new" + "Simplicity First"; `html`/`pdf` remain on the same row as derived caches (commented as derived; SSOT = the JSONB). New columns MUST use `ALTER TABLE ADD COLUMN IF NOT EXISTS` because `sr_lessons` already exists in prod (a `CREATE TABLE IF NOT EXISTS` block would no-op) — per `mod--database-schema.md` known-limit that the DDL is a creation script, mirroring the existing `sr_answer_events.attempt_id` `ADD COLUMN` pattern.
- Overlay table: `sr_lesson_i18n(lesson_id, locale, overlay JSONB, updated_at, PRIMARY KEY(lesson_id, locale))`, `overlay = { node_id: { text, src_rev } }`, FK `lesson_id → sr_lessons(id) ON DELETE CASCADE`. Prose only; contains no KEY. Covers card body prose, section names, read-check prompts/options, and exercise prompts/options/explanations uniformly.
- Ledger table: `sr_content_ledger(subject, stage, ledger JSONB, src_rev, updated_at, PRIMARY KEY(subject, stage))`, storing the existing `resources/content/math-ledger/stage-*.json` document shape verbatim. Ledger is authoring metadata (source `zh`), not part of the learner i18n overlay (seed G8 translates only learner-facing prose).
- Answer events: one `sr_content_answer_events(id, user_id FK→sr_users ON DELETE CASCADE, lesson_id FK→sr_lessons ON DELETE CASCADE, kind CHECK IN('read_check','exercise'), node_id, is_correct, chosen, answer_text, locale, created_at)` + index `(user_id, lesson_id)`. One table with a `kind` discriminator (read-check and exercise events share an identical shape; data is disposable per D12; JSONB items have no relational row identity, so `node_id` is the identity and there is no FK to a question row). Basis: engineering-rules SSOT/"one way", Simplicity First.
- Staleness: per-node `rev` in the neutral base and per-node `src_rev` in the overlay (stale ⇔ `overlay.src_rev < base.rev` or node absent) is a documented JSONB **convention**, demonstrated with sample rows — not DDL-enforced, because DDL cannot constrain JSONB internals without brittle CHECKs. The convention is owned by the generator/saver tickets (STEMROBIN-20/22/23).
- KEY isolation proof: cap6 inserts a disposable demo lesson (neutral base with KEY + `zh`/`en` overlays without KEY) and asserts via psql that the overlay JSONB contains none of `correct_index`/`accept`/`answer`. Runtime enforcement of "server strips KEY before any locale payload" is a service concern owned by the reader ticket (STEMROBIN-24), preserving the existing `quiz.ts` pattern.
- Idempotent DDL style throughout (`IF NOT EXISTS`) so re-applying the SSOT file on the shared DB is safe.

## Future Or Conditional Decisions

- Retiring the legacy relational deck (`sr_questions`, `sr_answer_events`) and the derived `sr_lessons.html`/`pdf` columns once the JSONB generator (STEMROBIN-20) and content migration (STEMROBIN-21) have populated + verified the JSONB SSOT — a later, deliberate migration, not this ticket.
- Populating `content`/`exercises`/`ledger`/overlays with real data — generator (STEMROBIN-20), migration (STEMROBIN-21), and English translation (STEMROBIN-23) tickets.
- Consuming `sr_content_answer_events` for learner progress — out of scope this batch (seed D6: events recorded but not consumed this round).
- Extending the same JSONB model to biography/story content — future (this round is math-only per `.tmp/plan-card-reading.md` scope).

## Out-of-Scope Guardrails

- No generator rebuild, no content migration, no card-reading UI, and no translation in this ticket — SCHEMA ONLY (草案 1 scope; STEMROBIN-20..24 own those). Backed by ticket intent, not an agent scope-cut.
- No changes to `app/src/lib/*`, the content-generation skills, or the story tables.
- No `DROP` and no destructive `ALTER` of any existing table; `sr_users` is referenced by no new statement and both existing credential rows remain intact. Backed by redline #2 + seed D12.
- No new dependency, no new recurring cost, no second DB client, no `search_path` bypass. Backed by ticket Constraints + engineering-rules.
