# IntentMill Handoff — STEMROBIN-40 rerender-html

## Summary

Regenerated the stale, DERIVED `sr_lessons.html` (+ `pdf`) cache for all 16 math lessons from the current JSONB SSOT through the existing canonical renderer, so each stored lesson now shows `sr-sec-num`(序号) + `sr-sec-name`(中文名) per section and a styled 练习 section — matching the PDF. This unblocks STEMROBIN-41 (which will surface the stored html as the full-text 速览). No renderer/template change was needed; the defect was purely the stale cache (left behind by STEMROBIN-34, which restored `card.name` into `content` but did not re-render html).

## Actual Changes

- Added `.agents/skills/sr-math-lesson/scripts/rerender-lessons.mjs` — deterministic, idempotent, reversible re-render. Reads `content`/`exercises` from `sr_lessons`, the `zh` overlay from `sr_lesson_i18n`, and the stage ledger from `sr_content_ledger`; builds `meta` exactly as `save-lesson.mjs`; calls the unchanged `renderLessonHtml` (+ best-effort `renderPdf`); snapshots current html first; then `update`s only `html`/`pdf`(coalesced)/`updated_at`. Flags: `--check` (dry-run diff), `--no-pdf`, `--id <id>`.
- Added ticket-scoped unit test `.intentmill/tickets/STEMROBIN-40-rerender-html/tests/render-invariants.test.mjs` (5 tests, pass).
- DB mutation (not a file change): re-rendered `html` + `pdf` for all 16 `sr_lessons` math rows. `content`/`exercises`/overlay/ledger/`sr_users` untouched.
- Snapshots: `.intentmill/tickets/STEMROBIN-40-rerender-html/refs/html-snapshot/<id>.html` (16 files, pre-mutation html — reversible).

No change to `render-lesson.mjs`, `assets/lesson-template.html`, `save-lesson.mjs`, `db.mjs`, or `app/**`.

## Verification (empirical)

- `--check` before: all 16 "WOULD CHANGE" (all stale). After the run, `--check` again: 0 html changed (idempotent).
- All 16 stored html: numbered section labels whose names equal the `content` JSONB names, a `data-sr-section="practice"` 练习 section, and 0 answer-key DATA tokens (`correct_index`/`"accept"`/`answer_text`). Spot-check math-s3-07: 1 为什么学这个 / 2 讲解 / 3 例题 / 4 与其他知识点的联系 / 5 概念口试 / 6 练习 (was stale "为什么需要它").
- Snapshot reversibility: math-s3-07 snapshot still holds the stale "为什么需要它"; DB now holds "为什么学这个".
- Sample generation (R4): `render-lesson.mjs` CLI on a fresh sample whose deck carried `key.correct_index` → number+name+styled practice, 0 KEY leaked (non-destructive; no shared-DB write).
- JSONB/`sr_users` untouched: all 16 cards still named; card/exercise counts intact.
- 16 PDFs re-rendered (988KB–2128KB) via the already-present `playwright-core` + cached chromium (no new dependency).
- Unit test: `node --test …/render-invariants.test.mjs` → 5 pass / 0 fail.

## Spec And Plan Alignment

- Spec obligations R1–R7: all met and evidenced (see `tests/test-results.md ## Coverage Map`).
- Plan obligations: implemented exactly as planned — one new DB-driven re-render script reusing `renderLessonHtml`/`renderPdf`, no renderer edit, html-only snapshot, `pdf = coalesce(new, old)`, ledger-sourced `meta`.
- Critical existing contracts preserved: single render path reused (re-render == fresh save); derived-cache-only writes; answer-key secrecy (structurally, and asserted with a key-bearing deck); JSONB-first practice (no deck re-save needed); server-only DB access; no new dependency.
- Non-scope / rejected options: renderer/template unchanged (grill `polish-renderer`); save-lesson file+outline path not used (grill `rerender-mechanism`); no app change; no JSONB/overlay/`sr_users` change.
- Test obligations: covered by the ticket-scoped unit test + empirical DB verification, per the Coverage Map.
- Deviations from plan: none.

## Missed User-Review Points

None. (Full delegation; all blocking decisions were self-adjudicated from the charter + code/evodocs evidence and recorded in `im-grill.md`. None affect requirements, acceptance, architecture, data/privacy, or security.)

## Residual Issues / Future Improvements

- STEMROBIN-41 (next, unblocked): switch the full-text 速览 to consume this now-current stored `sr_lessons.html`. How the app frames the standalone document (its own `<head>`/KaTeX/authoring-comment chrome) is STEMROBIN-41's concern.
- Pre-existing, out-of-scope template chrome (NOT introduced here; left intact per Surgical-Changes): (a) `lesson-template.html` still carries the authoring-guide HTML comment containing a literal `sr-sec-num`/`中文名` example (a non-rendered comment); (b) the template's `.sr-answer` CSS block is dormant under JSONB-first render (no `.sr-answer` elements are emitted) — it carries no answer data. Either could be trimmed in a future renderer-polish ticket if desired.
- PDF bytes are best-effort and not byte-deterministic across runs (html is byte-deterministic); idempotence is asserted on html.

## Blocker

None.

## Commit Status

STOP at a verified worktree per role (n-im executor, cap3→cap6). No merge, no cap8, no push, no deploy. Working tree changes: `rerender-lessons.mjs`, the ticket `refs/` (draft/grill/spec/plan/handoff + html-snapshot) and `tests/`. The DB html/pdf columns are already updated. Commit is left to the governor / cap8.
