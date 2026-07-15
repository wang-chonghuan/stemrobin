# IntentMill Handoff — STEMROBIN-34 恢复 section 与课文标题并改生成器

## Summary

The STEMROBIN-21 migration split each lesson into cards but dropped every
section's Chinese display name (中文名); cards had only `anchor`+`num`. This ticket
(1) restores each card's section name into `sr_lessons.content` from the migration
snapshots via a temporary deterministic script, and (2) makes the section name a
**required** per-card field going forward in the `sr-math-lesson` generator. The
lesson title (`sr_lessons.title`) was never lost and stays available.

## Actual Changes

**Restore (temporary script)**
- `.agents/skills/sr-math-lesson/scripts/restore-section-names.mjs` (new). Pure,
  exported `extractSectionNames` / `anchorNameMap` / `applyNames`, plus a DB
  driver. For each of the 16 STEMROBIN-21 snapshots it parses the ordered
  `<section data-sr-section="ANCHOR"> … <span class="sr-sec-name">中文名</span>`,
  builds the `anchor → name` map, backs the lesson's current `content` up to
  `refs/content-backup/<id>.json`, then `UPDATE sr_lessons SET content` adding a
  `name` to each matching card. `--check` = dry-run. Idempotent; fails fast if a
  card anchor has no snapshot name.
- **Anchor↔name mapping**: each genre has a unique, ordered anchor set
  (`check-content.ANCHORS`), so the card's `anchor` is an unambiguous key into the
  snapshot's per-section `sr-sec-name`. The snapshot's trailing `practice` section
  has no card and is ignored (matching the original migration, which excluded it).
- Backups: `.intentmill/tickets/STEMROBIN-34-restore-titles/refs/content-backup/*.json` (16 files).

**Generator (section name required + carried)**
- `scripts/check-content.mjs` — `validateContent` now flags any card whose `name`
  is not a non-empty string (runs inside `save-lesson.mjs` before any write).
- `scripts/render-lesson.mjs` — renders `card.name` in the `sr-sec-name` label and
  throws if a card has no name; the hardcoded parallel `ANCHOR_NAME` dict is
  **removed** (content JSONB is the single source for the label).
- Docs SSOT updated: `ssot-schemas/db-schemas/stemrobin.sql` (content-shape
  comment), `SKILL.md`, `references/common/lesson-contract.md`,
  `references/capability-2-lesson-html/lesson.md`.

**Tests**
- `tests/extract-section-names.test.mjs` (unit — the pure extraction).
- `tests/generator-sample.test.mjs` (disposable sample — name required + emitted).

## How the anchor↔name mapping is derived

The migration snapshots preserve, per teaching section, `data-sr-section="ANCHOR"`
and the `<span class="sr-sec-name">中文名</span>` that the migration's
`extractSectionInner` had stripped. Because a lesson's genre fixes a unique ordered
anchor set, matching a card to its snapshot section by `anchor` is exact and
order-independent. Section open tags are exactly `<section data-sr-section="…">`
and the names carry no HTML entities, so extraction is lossless.

## Empirical proof (gate 6)

- **All 16 lessons, 0 cards missing a name** (psql): `SELECT count(*) … WHERE
  (c->>'name') IS NULL OR (c->>'name')=''` → **0**. Per-lesson `total == named`
  for every id (`math-s2-01..08`, `math-s3-01..08`; e.g. s2-08 練習課 1/1,
  s3-01/04 概念課 6/6).
- **Spot-check `math-s3-07`** (方法課): motivation→为什么学这个, explain→讲解,
  examples→例题, connections→与其他知识点的联系, oral→概念口试. Title still
  `去分母解方程`.
- **Names match the snapshots** and are the original per-lesson names, not a
  generic dict — e.g. `math-s3-01` motivation=`先把"不知道"放到桌上`, `math-s3-04`
  motivation=`为什么要给方程分类起名`.
- **Idempotent**: re-run `--check` → `16 lessons · 0 needed a name change`.
- **Surgical**: `math-s3-04` current `content` minus the `name` fields is
  byte-identical to its pre-mutation backup (`true`); backups had no `name`.
- **Restored content still valid**: all 16 lessons pass the stricter
  `check-content` for their genre (16 validated, 0 failed).
- **Generator emits the name**: a disposable sample (`math-s99-01`, in-memory)
  passes `check-content`, and `render-lesson` emits every card's name in its
  `sr-sec-name` label (verified via a CLI render too); nothing persisted to the DB.
- **Generator requires the name**: stripping a card's `name` makes `check-content`
  report `name (section 中文名) must be a non-empty string` and makes
  `render-lesson` throw `missing its section name`.
- **Unit + sample tests**: `node --test tests/*.mjs` → **10 pass / 0 fail**.

## sr_users / prose untouched

`sr_users` is never referenced. The only DB write is `UPDATE sr_lessons SET
content, updated_at` per lesson, adding just the `name` field; `body`,
`read_check`, `num`, `anchor`, `rev`, `exercises`, `title`, `html`, `pdf`, and the
`zh`/`en` overlays are unchanged (proven byte-identical above). No `sr_*` row was
hand-written; the write goes through the skill's server-only `postgres` (`db.mjs`).
No new dependency; no `app/` change.

## Deviations

None from im-plan.md.

## Missed user-review points

None. Full-delegation seed; all blocking decisions self-adjudicated from the
charter in im-grill.md (D1–D6) and reflected in im-spec.md.

## Residual issues / future improvements (for STEMROBIN-35, which this unblocks)

- **Derived `html`/`pdf` caches not re-rendered.** `sr_lessons.html` still shows
  the OLD generic section labels (the removed `ANCHOR_NAME` values) because it is a
  derived cache and was not regenerated (out of scope — R5-D5). The consumer ticket
  should re-render from `content` (or render section labels + the lesson title
  directly from `content`/`title`) so the restored 中文名 and the 課文 title appear
  in 全文速览. Note: stage-2 lessons cannot be re-saved through `save-lesson.mjs`
  today (the ledger-vs-outline known-limit), so regeneration must render-only and
  update `html` directly, or the app should render labels from the JSONB.
- **`migrate-lib.htmlToCards` is now name-lossy vs the stricter contract.** The
  frozen STEMROBIN-21 migration would emit `name`-less cards that fail
  `check-content`. It is on no live path; left untouched (the seed chose a separate
  restore script). If migration is ever re-run, capture `sr-sec-name` there too.
- **Section names are source-zh in the neutral base.** Per-locale translation of
  section labels is a future translation-ticket concern.
- **`restore-section-names.mjs` is a temporary one-shot.** It can be removed once
  its run is recorded; kept for now for reproducibility/reversibility.

## Charter drift

None. No stack, dependency, deploy, redline, or `sr_users` change. Deterministic
content write through the skill's server-only DB path; docs kept as the SSOT.

## Commit status

Uncommitted — n-im executor stops at a verified worktree (no commit, merge, cap8,
push, or deploy). Changed/added:
- `.agents/skills/sr-math-lesson/scripts/{restore-section-names.mjs (new),
  check-content.mjs, render-lesson.mjs}`
- `.agents/skills/sr-math-lesson/{SKILL.md,
  references/common/lesson-contract.md,
  references/capability-2-lesson-html/lesson.md}`
- `ssot-schemas/db-schemas/stemrobin.sql` (content-shape comment)
- `.intentmill/tickets/STEMROBIN-34-restore-titles/refs/{im-*.md, content-backup/*.json}`
- `.intentmill/tickets/STEMROBIN-34-restore-titles/tests/*.test.mjs`
DB: `sr_lessons.content` for the 16 lessons now carries per-card `name` (applied).
