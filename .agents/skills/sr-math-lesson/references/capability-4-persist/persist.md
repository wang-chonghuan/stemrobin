# Capability 4 — Persist lesson + deck to the DB

Deterministic — only via `scripts/save-lesson.mjs`; never hand-write rows. Read `references/common/lesson-contract.md` (Ids & DB).

## Prerequisite

Tables live in `ssot-schemas/db-schemas/stemrobin.sql` and are applied to the easy-app Postgres `stemrobin-schema`. `sr_questions` carries `answer_mode ∈ choice|work|input`, `accept jsonb`, `layer`, `review_of`; `sr_answer_events` carries `answer_text`. If the saver reports missing columns, re-apply the SSOT schema.

## Usage (from repo root)

課文 (validates anchors per genre, renders print PDF via playwright-core when available, upserts `sr_lessons`):

```bash
node .agents/skills/sr-math-lesson/scripts/save-lesson.mjs \
  --id math-s2-03 --subject math --stage 2 --order 3 --genre 概念课 \
  --title "式子的两层：项与因数" --concept "一句话核心" --status draft \
  --html <scratch>/math-s2-03.html
```

Deck (validates item shape incl. input/accept, replaces `sr_questions`):

```bash
node .agents/skills/sr-math-lesson/scripts/save-lesson.mjs \
  --id math-s2-03 --questions <scratch>/math-s2-03.questions.json
```

## Rules

- Persist only after gate-2 (課文) and gate-3 (deck) passed. The saver guards shape; the gates guard meaning.
- Composition rules are `check-exercises.mjs`'s job — run it before the gate, not after persist.
- Re-running for the same id overwrites (idempotent). New lessons stay `draft` until promoted.
- After persisting a new/renamed lesson set, sync `src/lib/curriculum.ts` (app sidebar) with the ledger.
