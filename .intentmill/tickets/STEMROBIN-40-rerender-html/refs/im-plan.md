# IntentMill Plan

## Source Contract

Implements `im-spec.md` (R1–R7 and the Critical Existing Contracts). No requirement is added here beyond that spec.

## Implementation Approach

Add one skill script, `.agents/skills/sr-math-lesson/scripts/rerender-lessons.mjs`, that re-derives the `sr_lessons.html`/`pdf` cache from the JSONB SSOT already in the DB, reusing the canonical renderer. No other production file changes.

Reused, not reinvented:
- `render-lesson.mjs` `renderLessonHtml` + `renderPdf` (the one render path) — imported, unchanged.
- `db.mjs` `connect()` / `repoRoot()` (server-only postgres, `"stemrobin-schema"`) — imported, unchanged.
- `meta` construction identical to `save-lesson.mjs` (ledger-sourced `title`/`genre`/`theme`/`concept`).
- `pdf = coalesce(new, old)` upsert semantics from save-lesson.

Script behaviour:
1. Load every stage ledger from `sr_content_ledger` into a `(subject|stage) → ledger` map.
2. Select the math lessons (`id, subject, stage, lesson_order, content, exercises, html`); optional `--id` filter.
3. For each: find its ledger entry (fail fast if absent); load `zh` overlay from `sr_lesson_i18n` (fail fast if absent); build `meta`; `renderLessonHtml`.
4. `--check`: diff rendered vs stored html, report, write nothing.
5. Mutating run: snapshot current html to `refs/html-snapshot/<id>.html`; best-effort `renderPdf` (unless `--no-pdf`); `update sr_lessons set html, pdf = coalesce(new, pdf), updated_at = now() where id`.
6. Print a per-lesson + summary report.

## Implementation Drift Controls

- Only the `html`/`pdf`/`updated_at` columns are written. The SQL must never write `content`, `exercises`, `title`, `concept`, or any other column, and must never reference `sr_users`.
- `meta` fields come from the DB ledger (the SSOT save-lesson uses) — not hand-composed — so re-render output == fresh-save output.
- The renderer is imported and NOT edited (grill `polish-renderer`); if a section number/name/practice looks wrong, the fix is data (JSONB), not the renderer — but the JSONB is out of scope here, so such a case is a fail-fast, not a silent patch.
- No answer-key path is added; `renderChoiceOptions` already emits prompt+options only.
- Reversibility: snapshot html before every write. Determinism: html only (pdf is best-effort/non-byte-deterministic); idempotence asserted on html via a second `--check`.
- Answer-key verification distinguishes DATA tokens (`correct_index`/`"accept"`/`answer_text`) from the dormant `.sr-answer` CSS class.

## Phases

1. Write `rerender-lessons.mjs` (`--check`, `--no-pdf`, `--id` flags). Verify: `--check` reports all 16 stale → would change.
2. Run the mutating re-render (html + pdf) for all 16. Verify: report shows 16 html updated + 16 pdf rendered; 16 html snapshots written.
3. Idempotence: re-run `--check` → 0 html changed.
4. Empirical acceptance (psql/grep the stored html): all 16 have numbered section labels whose names equal the `content` JSONB names, a 练习 practice section, and 0 answer-key DATA tokens; spot-check math-s3-07 §1 = "为什么学这个". (R1–R3, R5, R6)
5. Sample-generation proof (R4): render a fresh disposable sample through the render path (non-destructive, no shared-DB write) and confirm number+name+styled practice and KEY-absence even when the sample deck carries key material.
6. JSONB/`sr_users` untouched check: all 16 cards still named; card/exercise counts intact.

## Unit Test Plan

Ticket-scoped `node --test` at `.intentmill/tickets/STEMROBIN-40-rerender-html/tests/render-invariants.test.mjs`, exercising the pure `renderLessonHtml` (the shared, high-risk helper the re-render and the generator both use):
- each content card renders `sr-sec-num` + its `sr-sec-name` (R1);
- the deck renders a styled numbered practice (练习) section after the teaching sections (R1);
- NO answer KEY (`correct_index`/`"accept"`/`answer_text`, nor an accept value as an option) reaches the html even when the input deck carries key material — the answer-key-secrecy high-risk assertion (R3);
- practice options render prompt + overlay-sourced option text only;
- a card missing its section name (中文名) fails fast (guards the un-stale contract).

The 16-lesson DB mutation is NOT unit-tested (it writes shared production rows); it is verified empirically against the DB in Phases 3–6 and recorded in `test-results.md`. The app vitest suite is not run: no `app/**` code is touched, so it is not a relevant regression surface for this ticket.

## Handoff Expectations

`im-handoff.md` records: the script added and the deliberate no-renderer-change decision; the empirical psql/grep proof over 16 lessons (numbered names + practice + 0 KEY, math-s3-07 spot-check); the sample-generation proof; idempotence evidence; snapshot location; confirmation that `content`/`exercises` JSONB and `sr_users` are untouched; `## Spec And Plan Alignment`; missed user-review points (or `None.`); residual issues / future improvements (e.g. the STEMROBIN-41 handoff and the dormant `.sr-answer` CSS / template authoring comment as pre-existing, out-of-scope chrome).
