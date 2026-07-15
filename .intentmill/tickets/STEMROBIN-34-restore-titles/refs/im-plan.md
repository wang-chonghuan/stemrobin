# IntentMill Plan — STEMROBIN-34

## Phase 1 — Temporary restore script (R1–R4)
`.agents/skills/sr-math-lesson/scripts/restore-section-names.mjs`:
- Pure, exported, unit-testable: `extractSectionNames(html)` → ordered
  `[{anchor,name}]`; `anchorNameMap(entries)` → `{anchor:name}` (throws on a
  conflicting duplicate); `applyNames(content, map)` → `{content, added, missing}`
  (adds `name` by anchor, does not mutate input, reports uncovered anchors).
- DB driver via `db.mjs` `connect()`: for each snapshot id, read `content`, apply
  names, fail fast on any missing anchor, write `refs/content-backup/<id>.json`,
  then `UPDATE sr_lessons SET content=…, updated_at=now()`.
- `--check` flag = dry-run (extract + diff + coverage, no write).

## Phase 2 — Generator: require the name (R5)
`scripts/check-content.mjs` — in the per-card loop, push a problem when
`typeof c.name !== 'string' || !c.name.trim()`. Update the header contract comment.

## Phase 3 — Generator: emit the name, drop the parallel source (R6)
`scripts/render-lesson.mjs` — delete the `ANCHOR_NAME` dict; `renderCard` reads
`card.name` and throws if missing; fix the stale "section names from overlay"
header comment.

## Phase 4 — Docs SSOT (R9)
Add `name` to the `content` card shape in `ssot-schemas/db-schemas/stemrobin.sql`
(comment), `SKILL.md`, `references/common/lesson-contract.md`, and
`references/capability-2-lesson-html/lesson.md`.

## Phase 5 — Empirical verification (gate 6)
- psql: 0 cards missing `name`; per-lesson total==named for all 16; spot-check
  `math-s3-07`; `title` present.
- Idempotency: re-run `--check` → 0 changes.
- Re-validate all 16 restored lessons with the stricter `check-content` (per genre).
- Unit-test the pure extraction (`tests/extract-section-names.test.mjs`).
- Disposable generator sample (`tests/generator-sample.test.mjs` + a CLI render):
  name required (reject when stripped) + emitted in the rendered label; nothing
  persisted to the DB.

## Rejected / non-scope
- Modifying `migrate-lib.htmlToCards` (frozen migration; separate script chosen).
- Re-rendering the 16 `html`/`pdf` caches; 全文速览 display (STEMROBIN-35).
- Putting the name in the overlay; per-locale name translation.
