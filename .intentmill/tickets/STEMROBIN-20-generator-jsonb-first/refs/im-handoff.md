# IntentMill Handoff

## Actual Changes

Rebuilt `.agents/skills/sr-math-lesson/` from HTML-first + file-ledger + `sr_questions`-deck to **JSONB-first**. The DB JSONB is now the content SSOT; HTML/PDF are rendered from it.

New scripts (`.agents/skills/sr-math-lesson/scripts/`):
- `ledger-core.mjs` — shared ledger validation core (schema + prerequisite closure + term-ownership uniqueness), extracted so the CLI checker and the DB saver share ONE closure implementation. Also exports `earlierTermsFor()` for the exercise review_of closure.
- `db.mjs` — shared server-only Postgres access (repo-root `.env` → `EASYAPP_DATABASE_URL`, `search_path="stemrobin-schema"`, ssl require). Never echoes the secret.
- `save-ledger.mjs` — validate a ledger document, upsert into `sr_content_ledger (subject, stage, ledger, src_rev)` on PK `(subject, stage)`, advancing `src_rev` on change. This makes the DB the ledger SSOT (G7).
- `check-content.mjs` — deterministic validation of the card-tree `content` JSONB + `zh` overlay: genre anchors present+ordered, every card has `num` (unique, contiguous from 1), every **substantial** card (teaching anchors except `oral` and the 练习课 orientation) has ≥1 `read_check`, read-check items well-formed per mode, body prose nodes reference the overlay, formula/svg neutral, and the overlay carries ONLY prose (no `correct_index`/`accept`/`answer` KEY). Exports `validateContent` + `validateItemKey`.
- `render-lesson.mjs` — pure + CLI renderer: (neutral `content` + neutral `exercises` + `zh` overlay + ledger metadata) → self-contained lesson HTML reusing `assets/lesson-template.html`'s head/shell (DESIGN tokens, KaTeX wiring, `data-sr-section`/`sr-sec-num`/`sr-sec-name`). Per card: `num` label + body (prose from overlay; formulas/SVG inline from `content`) + a KEY-free read-check projection; plus a consolidated KEY-free practice section from the deck. `renderPdf()` (playwright-core, best-effort) ported from the old saver. It NEVER reads `item.key`, so the KEY is structurally excluded from all learner-visible output.

Rewritten scripts:
- `save-lesson.mjs` — now the single JSONB-first content saver. Reads the ledger from `sr_content_ledger` (subject+stage parsed from `--id`), validates content+overlay (`check-content.mjs`) and exercises+overlay (`check-exercises.mjs`), for real stages runs the human-outline fidelity check (a disposable `--sample` skips only that check), renders HTML+PDF via `render-lesson.mjs`, and upserts `sr_lessons.content/exercises/html/pdf` (on conflict `id`) + `sr_lesson_i18n(locale='zh')` (on conflict `(lesson_id, locale)`). Idempotent; stable node ids. Replaced the old HTML-first + `sr_questions` deck path (that path also injected a practice section into stored HTML — now rendered from JSONB instead).
- `check-ledger.mjs` — thin CLI over `ledger-core.mjs` (keeps the `--vocab` HTML slice). Behavior-preserving.
- `check-exercises.mjs` — now validates the `exercises = {items:[…]}` JSONB shape (`id`/`mode∈choice|input|work`/`key` matching mode/`rev`) + its overlay prose, preserving the historical composition rules (16–24 items, 指认≥25%, 操作≥20%, ≥2 辨错, ≥2 说理, 复习 tail, review_of closure against the DB ledger). Exports `validateExercises`.

Docs updated to the JSONB-first flow: `SKILL.md`, `references/common/lesson-contract.md` (JSONB-first + Ids & DB), `references/capability-4-persist/persist.md` (rewritten), and JSONB-first banners on `references/capability-1-stage-ledger/ledger.md`, `references/capability-2-lesson-html/lesson.md`, `references/capability-3-exercises/exercises.md`.

Ticket-scoped tests: `.intentmill/tickets/STEMROBIN-20-generator-jsonb-first/tests/unit-tests.mjs` (20 assertions, all pass) + `test-results.md`.

No `app/`, `Dockerfile`, `ssot-schemas/`, or `app/src/lib/curriculum.ts` change. No new dependency (`npm install` only fetched the already-declared `postgres`/`marked`/`playwright-core`).

### Empirical proof (disposable sample `math-s99-01`, stage 99)

- `sr_content_ledger`: `math | 99 | src_rev 1 | SAMPLE 代数入门（disposable · STEMROBIN-20 proof） | 1 lesson`.
- `sr_lessons` row: `content` = 5 cards, `exercises` = 16 items, `html` = 19617 chars / 21851 bytes, `pdf` = 769183 bytes (real `%PDF-` v1.4, 5 pages), `has_content=t`, `has_exercises=t`.
- `sr_lesson_i18n`: `math-s99-01 | zh | 105 overlay nodes`.
- Cards: num 1..5; substantial (motivation/explain/examples/connections = num 1–4) each have 1 read-check; `oral` (num 5) has 0 (correctly excluded).
- KEY placement: `content.cards[1].read_check[0].key = {"correct_index":0}` and `exercises.items[0].key = {"correct_index":0}` (neutral base). Overlay KEY-scan = `clean`.
- Stored derived HTML grep for `correct_index|"accept"|"answer"|"key"` → **none**. Anchors present: motivation/explain/examples/connections/oral/practice.
- Ledger-from-DB: no local `resources/content/math-ledger/stage-99.json` exists, yet `save-lesson.mjs` succeeded — proving the ledger came from `sr_content_ledger`; `save-lesson.mjs` references only `sr_content_ledger` for the ledger read.
- Cleanup: sample `sr_lessons` / `sr_content_ledger` (stage 99) / `sr_lesson_i18n` rows deleted → 0 remain. Real data intact: 16 `math-s2-*/math-s3-*` lessons present; `sr_users` = 2 rows (untouched).

## Spec And Plan Alignment

Implementation matches `im-spec.md` and follows `im-plan.md`'s module surface, with one naming choice: the plan offered "`save-content.mjs` (new) OR a rebuilt `save-lesson.mjs`" — I rebuilt `save-lesson.mjs` (single persistence path, SSOT/one-way) rather than adding a second saver file. Behavior is exactly as specified.

Internal implementation contract coverage:
- **Spec obligations** R1–R10: all delivered and empirically proven (ledger-from-DB; ledger/content/exercises persistence; content+exercises JSONB shapes; substantial-card read-check; zh overlay; render-from-JSONB; derived html/pdf caches; deterministic validate-before-save + three-phase discipline; disposable sample proof + cleanup).
- **Plan obligations**: `ledger-core`/`save-ledger`/`render-lesson`/`check-content`/adapted `check-exercises`/rebuilt `save-lesson` all built; validators run before every DB write; the closure algorithm and composition rules are reused, not reimplemented.
- **Critical existing contracts preserved**: answer-key secrecy (overlay + HTML both KEY-free, enforced by `check-content.mjs` + a render that never emits `key` + empirical grep); genre section anchors (fixed set/order, validated); ledger prerequisite closure + term uniqueness (shared core, verified behavior-preserving on real ledgers); exercise composition rules; deterministic-save-only persistence (no hand-written rows); derived-HTML cache so the app reader is unchanged; idempotent upsert keys.
- **Non-scope / rejected options absent**: no migration of the 16 lessons/on-disk ledgers, no reading UI, no `en` translation, no `app/`/`Dockerfile`/`curriculum.ts` change, no new dependency; the rejected "inline prose in `content.body`" option is absent (prose lives in the `zh` overlay, renderer joins).
- **Test obligations**: every `## Unit Test Plan` item is covered (see `test-results.md ## Coverage Map`).

## User Review Points

None. All six blocking decisions were adjudicated from the charter + STEMROBIN-19 schema contract + decided design docs under full delegation (prodfarm cap13); no grill-leak surfaced, and development exposed no missed decision that affects requirements, acceptance, architecture, data/privacy, or security.

## Residual Issues And Future Improvements

- **Evodocs drift (expected):** `.evodocs/modules/mod--content-generation.md` and `mod--content-generation--math-courseware.md` still describe the pre-rebuild HTML-first `sr_questions` pipeline. Reconciling them is an n-evodocs concern for the governor after merge (not edited in this ticket).
- **Obsolete helpers left in place:** `scripts/choice-deck.mjs` and `scripts/backfill-choice-decks.mjs` targeted the old `sr_questions` flat deck and are superseded by the JSONB `exercises` deck. Left un-deleted per the surgical-changes rule; a future cleanup could remove them.
- **Downstream tickets (out of scope, now unblocked):** STEMROBIN-21 (migrate the 16 lessons + on-disk stage ledgers into JSONB — reuses `render-lesson.mjs`/`check-content.mjs`/`check-exercises.mjs`/`save-ledger.mjs`), STEMROBIN-22 (card reading UI consuming `read_check[]`), STEMROBIN-23 (`en` translation overlay). The `zh` source overlay authored here is the prerequisite STEMROBIN-23 adds to.
- **Renderer node vocabulary:** `content.body[]` supports `prose`/`formula`/`svg` node kinds (sufficient for the genre sections). Richer worked-example/step structure, if wanted later, can be added as new neutral node kinds without changing the persistence contract.
- **PDF is best-effort** by mechanism (playwright-core browser launch); it succeeded here (751KB, 5 pages). If a future environment lacks a browser engine, the saver reports the missing PDF rather than fabricating one, and acceptance-critical runs should treat that as a blocker.
