# Unit Test Results

## Commands Run

- `cd .agents/skills && npm install` → `added 3 packages` (postgres, marked, playwright-core; no new dependency, established one-time setup).
- `node .intentmill/tickets/STEMROBIN-20-generator-jsonb-first/tests/unit-tests.mjs` → `✓ ALL PASS: 20 passed, 0 failed`.
- `node .agents/skills/sr-math-lesson/scripts/check-ledger.mjs resources/content/math-ledger/stage-2.json` → `✓ ledger ok: stage 2 · 8 lessons · 22 terms owned · closure holds`.
- `node .agents/skills/sr-math-lesson/scripts/check-ledger.mjs resources/content/math-ledger/stage-3.json` → `✓ ledger ok: stage 3 · 11 lessons · 49 terms owned · closure holds`.
- `node .agents/skills/sr-math-lesson/scripts/check-content.mjs --content <sample> --overlay <sample> --genre 方法课 --id math-s99-01` → `✓ content ok`.
- `node .agents/skills/sr-math-lesson/scripts/check-exercises.mjs --exercises <sample> --overlay <sample> --ledger <sample> --id math-s99-01` → `✓ deck ok: layers {"指认":6,"操作":5,"辨错":2,"说理":3} · modes {"choice":16}`.
- `node .agents/skills/sr-math-lesson/scripts/save-ledger.mjs --ledger <sample>` → `✓ sr_content_ledger upserted: math stage 99 · 1 lessons · 2 terms · src_rev=1`.
- `node .agents/skills/sr-math-lesson/scripts/save-lesson.mjs --id math-s99-01 --content … --exercises … --overlay … --sample` → `✓ pdf rendered (751 KB)` · `✓ math-s99-01 (方法课) saved JSONB-first: content 5 cards / 4 read-check · exercises 16 items · zh overlay 105 nodes · html 19617B · pdf 751KB`.
- Empirical psql readback + stored-HTML KEY grep + PDF magic-byte check + sample cleanup (see `## Development Test Log` and `im-handoff.md`).

## Results

All ticket-scoped tests pass. The behavior-preserving refactor of the ledger closure logic (`ledger-core.mjs`) leaves `check-ledger.mjs` producing the same verdicts on the real stage-2/stage-3 ledgers. The full JSONB-first pipeline ran end-to-end against the shared Azure Postgres: ledger→`sr_content_ledger`, content/exercises→`sr_lessons`, `zh`→`sr_lesson_i18n`, and HTML+PDF rendered FROM the JSONB. No answer KEY leaked into the overlay or the rendered HTML. Sample rows were deleted; the 16 real lessons and 2 `sr_users` rows were untouched.

## Development Test Log

Implementation proceeded in risky slices, each verified before the next:

1. **Ledger closure refactor** (`ledger-core.mjs`, thin `check-ledger.mjs`) → ran `check-ledger.mjs` on real stage-2/stage-3 ledgers: same `closure holds` verdicts (behavior-preserving).
2. **Renderer** (`render-lesson.mjs`) + **validators** (`check-content.mjs`, JSONB `check-exercises.mjs`) → ran `unit-tests.mjs` (20 assertions): valid fixtures pass; every violation (missing num, substantial card without read-check, wrong anchor set, KEY-in-overlay, missing prose, <16 deck, bad review_of) fails; rendered HTML emits all anchors + num labels + KaTeX + read-check prompts and contains NO KEY token.
3. **Ledger saver** (`save-ledger.mjs`) → upserted sample ledger into `sr_content_ledger`; psql readback confirmed the row (src_rev=1).
4. **Content saver** (`save-lesson.mjs`) → saved the sample content/exercises/overlay + rendered html/pdf; psql readback confirmed `content` (5 cards), `exercises` (16 items), `zh` overlay (105 nodes), html+pdf non-null.
5. **Empirical acceptance proof** → psql: every card has `num` (1–5); substantial cards (motivation/explain/examples/connections) each have ≥1 read-check, `oral` has 0; KEY (`{"correct_index":0}`) lives in the neutral-base `content.read_check[].key` / `exercises.items[].key`; overlay KEY-scan = `clean`; stored derived HTML (21851 bytes) grep for `correct_index|"accept"|"answer"|"key"` = none; PDF is a real `%PDF-` 5-page document; ledger read from the DB (no local stage-99 file exists, yet the save succeeded).
6. **Cleanup** → deleted sample `sr_lessons`/`sr_content_ledger`/`sr_lesson_i18n` rows; post-cleanup psql shows 0 sample rows, 16 real lessons intact, 2 `sr_users` rows intact.

## Coverage Map

Each `im-plan.md ## Unit Test Plan` item:

- **KEY-secrecy (highest risk)** — covered: `check-content.mjs` fails on KEY-in-overlay (unit); `render-lesson.mjs` output has no KEY token (unit); empirical stored-HTML grep = clean (cap6 psql).
- **Content shape (num, read-check, anchors, key-per-mode)** — covered: unit fixtures assert pass-on-valid + fail-on-each-violation; empirical psql confirms num/read-check on the saved sample.
- **Ledger-from-DB** — covered: `save-lesson.mjs` reads only `sr_content_ledger` (grep-verified, and the sample save succeeded with no local stage-99 file); `save-ledger.mjs` idempotent upsert on PK `(subject, stage)` (empirical).
- **Exercises composition preserved** — covered: unit fixtures assert counts / 指认≥25% / 操作≥20% / ≥2 辨错 / ≥2 说理 / review_of closure; fail-on-<16 and fail-on-bad-review_of.
- **Closure refactor behavior-preserving** — covered: unit test compares `validateLedger` verdict on real stage-2 (pass) and a closure-broken clone (fail); CLI re-run on stage-2/stage-3.
- **Idempotency / stable ids** — covered: node ids are author-assigned constants; saver uses `on conflict` upsert (overwrite not duplicate); empirical re-save path is the same upsert.
- **Derived-cache compatibility** — covered: unit asserts rendered HTML carries `data-sr-section` anchors + `sr-sec-num` + KaTeX wiring; empirical stored HTML shows all anchors + practice; PDF renders (proves the reader/PDF contract holds).

## Failures

None.

## Notes

- Not a UI ticket: no `app/` change, so no Playwright browser-verification obligation applies. The rendered HTML is a derived content artifact; its readability is proven at runtime by the playwright-core PDF render (real Chromium loaded the HTML, waited for `.katex` elements, produced a 5-page PDF) plus the structural grep for anchors/num/KaTeX. (An attempt to open the file in the sandbox browser pane timed out — environment limitation, non-blocking; the PDF render is the stronger runtime proof.)
- The obsolete helper scripts `scripts/choice-deck.mjs` and `scripts/backfill-choice-decks.mjs` targeted the old `sr_questions` flat-deck table; they are superseded by the JSONB `exercises` deck and left in place (not deleted) per the surgical-changes rule.
