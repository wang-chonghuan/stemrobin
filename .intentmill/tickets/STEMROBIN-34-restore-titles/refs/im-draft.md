# IntentMill Draft — STEMROBIN-34 恢复 section 与课文标题并改生成器

## Source

- Ticket intent: `.intentmill/tickets/STEMROBIN-34-restore-titles/intent.md` (read in full — enabler, batch 0006-titles-auth-cleanup, seed STEMROBIN-32 full-delegation).
- Ticket meta: `meta.json` (ticket_key STEMROBIN-34-restore-titles).
- Seed grill decision `.prodfarm/batches/0006-titles-auth-cleanup/grill.md` **G-2**: `sr_lessons.title` still in the DB; card nodes lost the section 中文名 (only anchor+num remain); recover from the STEMROBIN-21 migration snapshots' `sr-sec-name` into `content` JSONB **and** change the generator to always produce it.
- Charter (`.prodfarm/charter/` via intent.md): obeyed Simplicity First, Surgical Changes, SSOT/one-way, deterministic content-saver-only DB writes, never hand-write `sr_*`, never touch `sr_users`, `.env` never staged, no new dependency.
- Evodocs read: `mod--content-generation--math-courseware.md` (ledger→content→deck→saver discipline; content JSONB is SSOT; html/pdf are derived caches), `mod--database-schema.md` (`sr_lessons.content` JSONB shape; content is the authority).
- Skill studied: `.agents/skills/sr-math-lesson/` — `render-lesson.mjs`, `save-lesson.mjs`, `check-content.mjs`, `migrate-lib.mjs`, `db.mjs`, `SKILL.md`, `references/common/lesson-contract.md`.
- Grounding queries (read-only, then the write): 16 lessons carry `content.cards` (`math-s2-01..08`, `math-s3-01..08`); **0** cards had a `name`; the renderer derived the label from a hardcoded per-genre `ANCHOR_NAME` dict — a parallel, lossy source that does not match the original per-lesson names.

## Draft Spec

> DRAFT — refined in im-spec.md.

1. **Restore.** A temporary, deterministic, idempotent script parses each of the 16 STEMROBIN-21 snapshots (`…/snapshots/<id>.html`), extracts the ordered `data-sr-section` anchor → `sr-sec-name` (中文名) mapping, and writes a `name` field onto the matching card in `sr_lessons.content`. It ONLY adds `name` (prose/body/read_check/exercises/title/html/pdf untouched), snapshots each lesson's pre-mutation content first (reversible), and re-running is a no-op.
2. **Generator.** `name` becomes a **required** per-card field going forward: `check-content.mjs` rejects a card without a non-empty `name`; `render-lesson.mjs` renders `card.name` as the section label and fails fast if missing; the hardcoded `ANCHOR_NAME` dict is removed (one SSOT). The rest of the JSONB + pedagogy contract is unchanged.
3. `sr_lessons.title` stays available and unchanged for the lesson title.

## Draft Plan

1. `scripts/restore-section-names.mjs` — pure `extractSectionNames`/`anchorNameMap`/`applyNames` + a DB driver (`--check` dry-run; default writes backups then updates `content`).
2. `check-content.mjs` — add the required-`name` rule.
3. `render-lesson.mjs` — render from `card.name`, drop `ANCHOR_NAME`, fail fast.
4. Docs SSOT — schema comment, `SKILL.md`, `lesson-contract.md`, `capability-2-lesson-html/lesson.md`.
5. Prove: psql (0 missing names, spot-check math-s3-07), idempotency, restored content passes the stricter validator for all 16, unit test the pure extraction, disposable generator sample.

## Code And Evodocs Findings

- `migrate-lib.htmlToCards` (STEMROBIN-21) built cards via `extractSectionInner`, which **strips** `<div class="sr-sec-label">` — this is exactly where the 中文名 was dropped. The snapshots preserve it in `<span class="sr-sec-name">`.
- `render-lesson.mjs` had `ANCHOR_NAME = {motivation:'为什么需要它', …}` (line 27) used at `renderCard` — a genre-generic label, not the original per-lesson name (e.g. snapshot `math-s3-01` motivation = `先把"不知道"放到桌上`). Restoring per-card `name` + rendering from it removes this parallel source (charter SSOT).
- `save-lesson.mjs` calls `validateContent` then `renderLessonHtml`; adding the rule to `check-content` + reading `card.name` in the renderer makes the field required through the real generator path with no new plumbing.
- Section open tags are exactly `<section data-sr-section="ANCHOR">`; `sr-sec-name` contents carry no HTML entities — extraction can be simple and lossless.

## Assumptions

- `name` is a plain per-card field in the neutral `content` base (source-zh), as the ticket instructs. Per-locale translation of section names is a future translation-ticket concern, not this enabler. (Grill G-2.)
- This enabler restores the DATA + fixes the generator; re-rendering the 16 derived `html`/`pdf` caches and surfacing titles/section names in 全文速览 is the downstream consumer's job (STEMROBIN-35, which this unblocks).
- The one-shot `migrate-lib.htmlToCards` is not modified — the seed explicitly chose a separate temporary restore script over touching the frozen migration.

## Risks

- Anchor mismatch between a snapshot and the DB cards → the script fails fast (reports missing anchors) rather than writing partial data.
- Removing `ANCHOR_NAME` makes the renderer hard-require `card.name`; mitigated because the restore populates all 16 and `check-content` enforces it before any save.

## Grill Required

completed (self-adjudicated from the charter — full-delegation seed)
