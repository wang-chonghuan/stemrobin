# Unit Test Results

## Commands Run

- `bash .intentmill/tickets/STEMROBIN-19-jsonb-ssot-schema/tests/verify-schema.sh` — applies the SSOT DDL to the shared Postgres (twice, for idempotency), runs structure/existence checks, seeds a disposable namespaced demo (`zzz-schema-verify-19`), proves the AC by psql query, cleans up, and asserts `sr_users` is unchanged. Exit 0, `ALL CHECKS PASSED`.
- `cd app && npm run test` (vitest run) — regression guard (app code unchanged). 16 passed / 2 files.
- Final clean-state confirmation query — `demo_lessons_left=0`, `new_tables=sr_content_answer_events,sr_content_ledger,sr_lesson_i18n`, `sr_lessons_jsonb_cols=content,exercises`.

## Results

verify-schema.sh (NOTICEs filtered):

```
== 0. sr_users baseline ==
  users(before) = 2|87f122dc9c8a236117a6264b041e5f14
== 1. apply DDL (idempotent: twice) ==
  apply #1 OK
  apply #2 OK (idempotent)
== 2. structure existence ==
  sr_lessons.content + .exercises columns present
  table sr_content_ledger present
  table sr_lesson_i18n present
  table sr_content_answer_events present
== 3. seed disposable demo (namespaced id=zzz-schema-verify-19) ==
  demo rows inserted
  kind CHECK rejects invalid value 'bogus'
== 4. AC-1 queryability ==
  per-stage ledger:      verify
  card-tree 编号:        1
  exercise deck items:   3
  locales with overlay:  en,zh
  answer events (kinds): read_check:c1q1,exercise:e2
== 5. AC-2 KEY isolation ==
  KEY present in neutral base (content.read_check.key.correct_index)
  KEY present on all 3 exercise items (neutral base)
  NO KEY in any locale overlay (structural=0, textual=0)
== 6. cleanup disposable demo ==
  demo rows removed (cascade-clean)
== 7. AC-3 sr_users integrity ==
  users(after)  = 2|87f122dc9c8a236117a6264b041e5f14
  sr_users UNCHANGED
ALL CHECKS PASSED
```

vitest:

```
 ✓ src/lib/answer-normalize.test.ts (7 tests)
 ✓ src/lib/curriculum.test.ts (9 tests)
 Test Files  2 passed (2)
      Tests  16 passed (16)
```

## Development Test Log

- Slice 1 — appended the four DDL structures to `ssot-schemas/db-schemas/stemrobin.sql`; captured `sr_users` baseline fingerprint (`2|87f1...`) before touching the DB.
- Slice 2 — applied the DDL to the shared Postgres via the runbook psql path. First run failed a script assertion (the psql `SET` command tag was leaking into captured query output, and the `kind` CHECK test ran before the demo lesson existed so an FK — not the CHECK — would have rejected it). Fixed the harness (`-q` to suppress status tags; moved the `kind`-CHECK negative test to after seeding so only the CHECK can reject) — the DDL itself applied correctly on the first attempt (apply #2 NOTICEs confirmed `content`/`exercises` already existed). Re-ran: all green.
- Slice 3 — proved AC-1 (queryability of ledger / content+exercises / overlay / answer events), AC-2 (KEY in neutral base, zero KEY in any overlay — structural via `jsonb ?` and textual via LIKE), AC-3 (`sr_users` fingerprint identical before/after), plus idempotency and the `kind` CHECK.
- Slice 4 — ran the vitest regression guard (app code untouched) and confirmed the persistent DB is in a clean final state (no demo rows; new tables + columns present).

## Coverage Map

Maps every `im-plan.md ## Unit Test Plan` item:

- Structure existence (R1–R6), incl. `sr_lessons.content`/`exercises` added as columns (R7 ALTER correctness) — covered by verify-schema.sh step 2 (`information_schema` checks).
- KEY isolation (R3, R4): KEY in neutral base, none in any overlay — covered by step 5 (`jsonb ?` structural + `LIKE` textual, both 0 in overlay; 1 in base read-check, 3/3 in exercises).
- Answer-event queryability + `kind` discriminator (R6) — covered by step 4 (both `read_check` + `exercise` rows query) and step 3 (`kind` CHECK rejects `bogus`).
- Idempotency (R7): DDL applied twice, both exit 0 — covered by step 1.
- `sr_users` integrity (R8): count/emails/hashes fingerprint identical — covered by steps 0 + 7.
- No-regression on untouched app consumers — covered by `cd app && npm run test` (16 passed).
- Rejected option absent (BD1): no prose column on neutral base; `zh` prose only via overlay — covered structurally (the neutral base has only `content`/`exercises` JSONB with no prose column; overlays carry the prose) and demonstrated by the demo rows.

## Failures

None. (The one intermediate failure was a test-harness bug, fixed and re-run green; the DDL applied correctly throughout — see Development Test Log slice 2.)

## Notes

- Backend-only ticket (DDL). No frontend surface — no component/Playwright tests applicable; recorded per cap6 test-design guidance.
- Verification runs against the SHARED live Azure Postgres (no local disposable DB; no `nf-db` skill in this repo — the runbook psql path is the DB access method). All demo rows are namespaced (`zzz-schema-verify-19`, `stage=99`) and deleted after capture; real content and `sr_users` were never modified.
- The JSONB internal shape (`cards[].read_check[].key`, `exercises.items[].key`, per-node `rev` / overlay `src_rev`) is a documented contract, not DDL-enforced; enforcement belongs to the generator/saver/reader tickets (STEMROBIN-20/22/23/24).
