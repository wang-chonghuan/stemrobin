# IntentMill Handoff

## Actual Changes

- `ssot-schemas/db-schemas/stemrobin.sql` — appended one additive, idempotent DDL block "JSONB CONTENT SSOT (STEMROBIN-19)" defining the JSONB content structure:
  - `ALTER TABLE sr_lessons ADD COLUMN IF NOT EXISTS content JSONB` — neutral card-tree SSOT (ordered cards: each with stable `id`, learner-visible `num` 编号, section `anchor`, per-node `rev`, ordered neutral `body`, and its own `read_check[]` items carrying the answer KEY).
  - `ALTER TABLE sr_lessons ADD COLUMN IF NOT EXISTS exercises JSONB` — neutral exercise-deck SSOT (ordered items: `id/ord/type/mode/layer/review_of/key/rev`).
  - `CREATE TABLE sr_content_ledger (subject, stage, ledger JSONB, src_rev, updated_at, PK(subject,stage))` — per-stage concept ledger in the DB.
  - `CREATE TABLE sr_lesson_i18n (lesson_id FK→sr_lessons ON DELETE CASCADE, locale, overlay JSONB, updated_at, PK(lesson_id,locale))` — per-locale text overlay `{ node_id → { t, src_rev } }`, prose only, no KEY; `zh` is the source locale represented as an overlay.
  - `CREATE TABLE sr_content_answer_events (id, user_id FK→sr_users ON DELETE CASCADE, lesson_id FK→sr_lessons ON DELETE CASCADE, kind CHECK IN('read_check','exercise'), node_id, is_correct, chosen, answer_text, locale, created_at)` + index `(user_id, lesson_id)` — disposable card/exercise answer events keyed by JSONB `node_id`.
  - Extensive SQL comments document the JSONB contract, KEY-in-neutral-base-only rule, and the `rev`/`src_rev` staleness convention.
- `.intentmill/tickets/STEMROBIN-19-jsonb-ssot-schema/tests/verify-schema.sh` — re-runnable empirical verification (apply DDL ×2, structure checks, disposable demo seed, AC queries, KEY-isolation assertion, `sr_users` fingerprint, cleanup).
- `.intentmill/tickets/STEMROBIN-19-jsonb-ssot-schema/tests/test-results.md` — captured evidence.
- The DDL was applied to the shared Azure Postgres (`stemrobin-schema`); the new tables/columns now exist in the live DB; no demo rows remain; no existing content or `sr_users` row was modified.

No `app/src/lib/*`, content-skill, or story-table code was changed (schema-only ticket).

## Spec And Plan Alignment

Implementation matches `im-spec.md` and `im-plan.md` with no deviation. Internal implementation contract coverage:

- Spec obligations (R1–R9): all met and empirically proven — per-stage ledger (R1), per-lesson neutral content + exercises (R2), KEY in neutral base (R3), per-locale overlay incl. `zh` source with no KEY (R4), `src_rev`/`rev` staleness convention documented + demonstrated (R5), card/exercise answer events with `kind` discriminator (R6), additive+idempotent DDL with `sr_lessons` columns via `ALTER ADD COLUMN IF NOT EXISTS` (R7), `sr_users` intact (R8), empirical psql proof captured (R9).
- Plan obligations: DDL appended to the single SSOT file; applied via the runbook psql path; verified twice for idempotency; disposable namespaced demo used for AC proof then cleaned up.
- Critical existing contracts preserved: answer-key secrecy strengthened structurally (KEY simply cannot exist in the overlay table); single server-only `sql()` client + `"stemrobin-schema"` search_path unchanged; `sr_lessons` columns added via ALTER (not a no-op CREATE block); FK `ON DELETE CASCADE` inherits the existing clean lifetime; additive apply touched no accumulated data.
- Non-scope / rejected options absent: no generator/migration/reading-UI/translation; no drop or destructive alter of `sr_questions`/`sr_answer_events`/story tables/`sr_lessons` existing columns; rejected inline-`zh`-prose option not built (neutral base is prose-free; `zh` prose lives in the overlay).
- Test obligations: every `## Unit Test Plan` item mapped in `test-results.md ## Coverage Map`; regression guard (`npm run test`) passes.

## User Review Points

None. All blocking decisions (BD1 `zh`-as-overlay, BD2 additive-DDL-on-shared-DB) were adjudicated from the charter + binding intent under full delegation (D11) and recorded in `im-grill.md`; no product decision required human input, and none surfaced during development. No grill-leak.

## Residual Issues And Future Improvements

- The JSONB internal shape (card `read_check[].key`, `exercises.items[].key`, per-node `rev`, overlay `src_rev`) is a documented contract, not DDL-enforced (Postgres does not constrain JSONB internals without brittle CHECKs). Enforcement — including the runtime rule that the server strips KEY before any locale payload — belongs to the downstream tickets: generator STEMROBIN-20, migration STEMROBIN-21, reading flow STEMROBIN-22, translation STEMROBIN-23, language-switch/e2e STEMROBIN-24.
- The new `content`/`exercises` columns are NULL on the existing 16 lessons and `sr_content_ledger`/overlays are empty until the migration ticket (STEMROBIN-21) and generator (STEMROBIN-20) populate them. Legacy `sr_questions`/`sr_answer_events` and `sr_lessons.html`/`pdf` remain in place as the current live source and derived caches; their retirement is a later, deliberate migration once the JSONB SSOT is populated and read.
- `sr_content_answer_events` is written-only structure this batch (seed D6: recorded, not consumed for progress) — progress consumption is future work.

## Charter drift

None. The change is confined to the DDL SSOT and matches the architecture (`sr_lessons` etc. in `ssot-schemas/db-schemas/stemrobin.sql`, applied via the runbook psql path). No stack, dependency, deploy-invariant, or runbook change. The architecture `## SSOT` note that lists the schema tables could optionally be extended by the governor to mention the new JSONB SSOT tables at batch settlement, but no charter edit is required for this ticket.
