# IntentMill Draft

## Source

- `.intentmill/tickets/STEMROBIN-40-rerender-html/intent.md` (read; enabler, batch 0007-reading-polish, seed STEMROBIN-39, full delegation).
- `.intentmill/tickets/STEMROBIN-40-rerender-html/meta.json` (read).
- `AGENTS.md` router + `.prodfarm/charter/` (goal / redlines / engineering-rules / architecture / runbook, embedded in intent) read and obeyed. Key rules applied: Simplicity First, Surgical Changes, SSOT/one-way; DB is server-only via the skill's `db.mjs`; content is DB-driven + skill-generated; answer-key secrecy; never touch `sr_users`; no new dependency.
- evodocs read (substantive): `.evodocs/modules/mod--content-generation--math-courseware.md` and `mod--database-schema.md` (both embedded in intent); `mod--app--domain-services.md`.
- Batch grill `.prodfarm/batches/0007-reading-polish/grill.md` read: G-A (速览改用 skill html + 重渲 16 课, STEMROBIN-34 遗留), G-C (render-lesson.mjs 有可打磨处则打磨).
- Code inspected: `.agents/skills/sr-math-lesson/scripts/render-lesson.mjs`, `save-lesson.mjs`, `db.mjs`, `restore-section-names.mjs`, `assets/lesson-template.html`.
- DB inspected via the skill's `db.mjs` (server-only `nf-db`-equivalent path; the skill's postgres client is the repo's only DB access for content scripts). 16 math lessons, all with `content`/`exercises` JSONB + `zh` overlay + stage ledger.

## Draft Spec

(draft) Regenerate the DERIVED `sr_lessons.html` (+ best-effort `pdf`) cache for all 16 math lessons FROM the current JSONB SSOT (`content` + `exercises` + `zh` overlay + `sr_content_ledger`), through the existing canonical renderer `render-lesson.mjs`, so the stored html is current + beautiful (each section shows `sr-sec-num`(序号) + `sr-sec-name`(中文名), plus a styled 练习 section matching the PDF). The stored html is STALE: it predates STEMROBIN-34's restore of `card.name`, so it still shows the pre-restore labels (e.g. math-s3-07 §1 shows "为什么需要它"; the JSONB now says "为什么学这个"). Polish `render-lesson.mjs` / the template CSS ONLY IF genuinely improvable. Do not modify the `content`/`exercises` JSONB, the overlay, or `sr_users`.

## Draft Plan

(draft) Write a deterministic, idempotent re-render script in the skill (`scripts/rerender-lessons.mjs`) that reads each lesson's JSONB from the DB, rebuilds `meta` exactly as `save-lesson.mjs` does (title/genre/theme/concept from the DB ledger), calls `renderLessonHtml` (+ best-effort `renderPdf`), snapshots the current html first (reversible), then `update`s only `html`/`pdf`/`updated_at`. Prefer a DB-driven re-render over reusing `save-lesson.mjs` because save-lesson requires file inputs and runs the human-outline fidelity check that a stage-2 ledger currently fails (evodocs known-limit) — that check is irrelevant to re-deriving a cache from already-validated JSONB. Verify empirically (psql/grep the 16 stored html for numbered names + practice + 0 KEY; spot-check math-s3-07) and with a ticket-scoped pure unit test of the render invariants.

## Code And Evodocs Findings

- `render-lesson.mjs` already emits `<span class="sr-sec-num">{card.num}</span><span class="sr-sec-name">{esc(card.name)}</span>` per card (`renderCard`) and a consolidated `renderPractice` section (`data-sr-section="practice"`, num = `secCount+1`, name 练习, `ol.sr-practice` with per-item `sr-ptype` tags). It structurally never reads `item.key` — `renderChoiceOptions` emits prompt + options only. So the acceptance's num+name+styled-practice + no-KEY are already properties of the renderer; the defect is purely the STALE stored cache, fixed by re-rendering.
- `save-lesson.mjs` is the canonical writer: it builds `meta = { id, subject, stage, order, title: entry.title, genre: entry.genre, theme: ledger.theme, concept: entry.core_idea }`, renders html + best-effort pdf, and upserts `sr_lessons(html, pdf, content, exercises, ...)` with `pdf = coalesce(excluded.pdf, sr_lessons.pdf)`. The re-render mirrors this meta and coalesce so a re-render == a fresh save.
- `restore-section-names.mjs` (STEMROBIN-34) wrote `card.name` into `content` but did NOT re-render `html` — confirmed root cause. DB probe: math-s3-07 stored html §1 = "为什么需要它" while `content.cards[0].name` = "为什么学这个".
- `sr_content_ledger` holds the stage ledgers in the DB (SSOT for title/genre/theme); `sr_lesson_i18n(locale='zh')` holds the overlay. Both present for all 16.
- `renderPdf` uses `playwright-core` (already in `.agents/skills/package.json`, chromium cached locally) — best effort, returns null on failure; the re-render then keeps the existing pdf via coalesce. No new dependency.
- evodocs mod--content-generation: "Re-saving an HTML lesson after the deck has been saved removes that generated practice, so the deck must be saved again." This applies to `save-lesson.mjs`'s two-step HTML-then-deck flow. It does NOT apply here: `renderLessonHtml` renders the practice FROM `exercises` in the SAME pass, so a JSONB-first re-render always includes the practice (verified: all 16 have the practice section). No deck re-save is required.
- Answer-key secrecy (charter + all three modules): the html projection may show prompts + options, never keys — preserved (renderer never emits keys; the ticket adds no serialization path).

## Assumptions

- The 16 `sr_lessons` rows' `content`/`exercises`/overlay are the intended current SSOT (STEMROBIN-21 migration + STEMROBIN-34 name restore + STEMROBIN-35 titles already landed on this branch). Re-rendering from them is correct.
- `sr_lessons.title` equals the ledger `entry.title`; meta uses the ledger value (canonical, matches save-lesson). Verified consistent for the spot-checked lessons.
- Best-effort PDF is acceptable per the module's stated "PDF rendering is best effort" limit; html is the deterministic, must-refresh artifact.

## Risks

- R-TEST: the re-render's core is orchestration around the pure `renderLessonHtml`; the meaningful unit target is that pure renderer (num+name, practice, KEY-absence, fail-fast on missing name). Ticket-scoped `node --test` covers it without a DB. The 16-lesson mutation itself is verified empirically against the DB (psql/grep), not unit-tested, because it writes shared production rows.
- Writing to the shared production DB (redline #2 = don't pollute/destroy accumulated data): mitigated — the re-render only rewrites the DERIVED html/pdf columns (never content/exercises/overlay/`sr_users`), snapshots html before mutating (reversible), and is idempotent.
- PDF non-determinism (playwright render bytes) means pdf is not byte-identical across runs; html is byte-deterministic. Idempotence is asserted on html (re-run `--check` → 0 changed).
- A false-positive "answer" grep hit exists: the template's dormant `.sr-answer` CSS chrome contains the substring "answer" but carries no answer DATA. Verification must distinguish key DATA (`correct_index`/`"accept"`/`answer_text`) from CSS class names.

## Grill Required

completed
