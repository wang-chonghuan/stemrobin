# IntentMill Spec — STEMROBIN-34 恢复 section 与课文标题并改生成器

The contract this ticket delivers. Obligations R1–R9 are individually verified in
im-handoff.md.

## R1 — Restore data completeness
After the restore, every card of every lesson in `sr_lessons.content` (all 16:
`math-s2-01..08`, `math-s3-01..08`) carries a non-empty section display name
(中文名) in a `name` field. Proven by psql: 0 cards missing/empty `name`.

## R2 — Names are the original per-lesson names
Each card's `name` equals the `sr-sec-name` of the matching
`<section data-sr-section="ANCHOR">` in that lesson's STEMROBIN-21 snapshot,
matched by anchor. Spot-check `math-s3-07`: motivation=为什么学这个, explain=讲解,
examples=例题, connections=与其他知识点的联系, oral=概念口试.

## R3 — Restore is deterministic, idempotent, reversible
`restore-section-names.mjs` is a deterministic script (pure extraction + DB
driver); re-running writes nothing new (0 changes); each lesson's pre-mutation
`content` is snapshotted to `refs/content-backup/<id>.json` before the write.

## R4 — Restore is surgical
The restore adds ONLY the `name` field. `content.cards[]` order, `body`,
`read_check`, `num`, `anchor`, `rev`, `exercises`, `title`, `html`, `pdf`, and the
`zh`/`en` overlays are unchanged. `sr_users` is never touched. No hand-written
rows (a single parameterized `UPDATE sr_lessons SET content` per lesson).

## R5 — Generator requires the section name
`check-content.mjs` (`validateContent`) reports a problem for any card whose
`name` is not a non-empty string. This runs inside `save-lesson.mjs` before any DB
write, so a new lesson without a section name cannot be persisted.

## R6 — Generator emits the section name
`render-lesson.mjs` renders `card.name` in the `<span class="sr-sec-name">` section
label (the SSOT), and throws if a card reaches the renderer without a `name`. The
parallel hardcoded `ANCHOR_NAME` dictionary is removed (one source of truth).

## R7 — Existing contract intact
The card-tree/deck/overlay JSONB shape, genre anchors, read-check policy,
answer-key secrecy, and the ledger→content→deck→saver discipline are otherwise
unchanged. All 16 restored lessons still pass `check-content` for their genre.

## R8 — Lesson title preserved
`sr_lessons.title` is available and unchanged for rendering (e.g. `math-s3-07`
= `去分母解方程`).

## R9 — Docs are the SSOT
The `name` field is documented as a required per-card field in the schema comment
(`ssot-schemas/db-schemas/stemrobin.sql`), `SKILL.md`, `lesson-contract.md`, and
`capability-2-lesson-html/lesson.md`.

## Non-scope (explicitly out)
- Re-rendering the 16 derived `html`/`pdf` caches, and surfacing the section names
  / lesson title in the 全文速览 UI — belongs to STEMROBIN-35 (unblocked by this).
- Per-locale translation of section names.
- Any change to `sr_users`, the app (`app/`), or the frozen STEMROBIN-21 migration.
