# Capability 4 — Persist lesson JSONB + render HTML/PDF

Deterministic — only via `scripts/save-ledger.mjs` + `scripts/save-lesson.mjs`; never hand-write rows. Read `references/common/lesson-contract.md` (JSONB-first + Ids & DB) first.

## Prerequisite

Tables live in `ssot-schemas/db-schemas/stemrobin.sql` (the "JSONB CONTENT SSOT" block) and are applied to the easy-app Postgres `stemrobin-schema`. The generator writes the neutral `content`/`exercises` JSONB, the `zh` prose overlay, and the derived `html`/`pdf` caches. If the saver reports a missing column/table, re-apply the SSOT schema.

## Usage (from repo root)

Ledger → DB (validate closure, upsert `sr_content_ledger`):

```bash
node .agents/skills/sr-math-lesson/scripts/save-ledger.mjs --ledger <scratch>/stage-2.json
```

Lesson (reads ledger from `sr_content_ledger`, validates content/exercises/overlay, renders HTML + print PDF FROM the JSONB, upserts `sr_lessons.content/exercises/html/pdf` + `sr_lesson_i18n(zh)`):

```bash
node .agents/skills/sr-math-lesson/scripts/save-lesson.mjs \
  --id math-s2-03 \
  --content <scratch>/math-s2-03.content.json \
  --exercises <scratch>/math-s2-03.exercises.json \
  --overlay <scratch>/math-s2-03.overlay.json
```

`--status draft|published` (default draft). `--sample` skips ONLY the human-outline fidelity check, for a disposable proof lesson on a stage that maps to no course-guide entry. `--outline <path>` overrides the human course guide for the fidelity check on real stages.

## Render (derived HTML/PDF)

The saver calls `scripts/render-lesson.mjs` to render the self-contained lesson HTML from (neutral `content` + neutral `exercises` + `zh` overlay + ledger metadata), reusing `assets/lesson-template.html`'s head/shell (DESIGN tokens, KaTeX wiring, section/label structure). It emits, per card, the `num` label + body (prose from the overlay; formulas/SVG inline from `content`) + a KEY-free read-check projection, plus a consolidated KEY-free practice section from the deck. A print PDF is rendered best-effort via playwright-core. `render-lesson.mjs` can also be run standalone to render from JSON files.

## Rules

- Persist only after gate-2 passes for the content and gate-3's fast deterministic deck check passes. The saver runs `check-content.mjs` (anchors, `num`, per-substantial-card read-check, KEY-free overlay) and `check-exercises.mjs` (deck shape + composition + review_of closure) before any DB mutation.
- The ledger is read from `sr_content_ledger` (subject+stage parsed from `--id`); it is NOT read from a local file. Run `save-ledger.mjs` first so the DB has the ledger.
- **Answer-key secrecy**: `correct_index`/`accept`/`answer` stay in the neutral-base `key`; they never enter the `zh` overlay or the rendered HTML. The renderer never emits `key`; the overlay validator fails on any leaked KEY.
- Re-running for the same id overwrites (idempotent; stable node ids). New lessons stay `draft` until promoted.
- After persisting a new lesson, its deterministic id automatically activates the matching catalog item. Keep `app/src/lib/curriculum.ts` aligned with the human course guide's titles/order, but do not hand-edit lesson availability ids.
- For a multi-lesson request, save every ledger + lesson, then verify each saved lesson's rendered title, read-check + practice sections, PDF, and a representative answer flow (desktop + mobile). The app reader consumes the derived `sr_lessons.html`, so no app change is needed.
