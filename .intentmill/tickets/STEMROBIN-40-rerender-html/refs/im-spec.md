# IntentMill Spec

## Intent

Make the stored, DERIVED `sr_lessons.html` (and `pdf`) cache for all 16 math lessons current and beautiful by regenerating it from the current JSONB SSOT through the existing canonical renderer. The stored html is stale: it predates STEMROBIN-34's restoration of each section's Chinese display name (`card.name`) into the `content` JSONB, so it still shows pre-restore labels (e.g. math-s3-07 §1 renders "为什么需要它" while the JSONB now holds "为什么学这个"). This ticket is the enabler that lets STEMROBIN-41 surface the stored html as the full-text 速览.

## Scope

- Re-render the `html` column of all 16 `sr_lessons` math rows from their `content` + `exercises` + `zh` overlay + stage ledger, via `render-lesson.mjs`'s `renderLessonHtml`.
- Re-render the `pdf` column for the same 16 rows via best-effort `renderPdf` (same html source), keeping the prior pdf when a render attempt fails.
- Provide a deterministic, idempotent, reversible re-render script in the skill.
- Snapshot each lesson's current html before mutation.

## Non-Scope

- No change to `render-lesson.mjs` or `assets/lesson-template.html` (the renderer already emits `sr-sec-num` + `sr-sec-name` per section and a styled 练习 section matching the PDF; polishing was adjudicated unnecessary — grill `polish-renderer`).
- No change to `content`/`exercises` JSONB, the `zh` overlay, `sr_content_ledger`, or any lesson metadata.
- No change to `sr_users`.
- No change to the app (`app/src/**`); surfacing the html as 速览 is STEMROBIN-41.
- No new dependency, no second renderer, no second DB client.
- No deck re-save; no answer-key serialization.

## Requirements

- R1 — After re-render, each of the 16 lessons' stored `html` renders every teaching section as `<span class="sr-sec-num">{num}</span><span class="sr-sec-name">{中文名}</span>` where `{中文名}` equals the section name in that lesson's `content` JSONB (proving the cache is no longer stale), plus a numbered, styled practice (练习) section (`data-sr-section="practice"`, `ol.sr-practice` with per-item type tags) whose number follows the last teaching section.
- R2 — Spot-check math-s3-07: §1 renders "为什么学这个" (not the stale "为什么需要它") and a 练习 section is present.
- R3 — The re-rendered html contains NO answer KEY: no `correct_index`, no `"accept"`, no `answer_text`, and no accept-form/answer value surfaced as an option. (The template's dormant `.sr-answer` CSS class is chrome, not answer data.)
- R4 — A newly generated sample lesson, rendered through the same render path, shows the same structure (section number + Chinese name + styled practice, and no KEY).
- R5 — The re-render is deterministic (same JSONB → same html) and idempotent (re-running produces 0 html changes).
- R6 — Before mutating, each lesson's current html is snapshotted to a reversible location.
- R7 — The `pdf` column is refreshed for all 16 when the local Playwright render succeeds; a render failure keeps the existing pdf (best effort).

## Critical Existing Contracts

- Render path SSOT: `render-lesson.mjs`'s `renderLessonHtml` is the ONE renderer; `save-lesson.mjs` uses it. The re-render must reuse it and must build `meta` the same way save-lesson does (`title`/`genre`/`theme`/`concept` from `sr_content_ledger`), so a re-render equals a fresh save.
- Derived-cache contract: `sr_lessons.html`/`pdf` are derived from the `content`/`exercises` JSONB + overlay SSOT (evodocs mod--content-generation / mod--database-schema). Only these derived columns may be rewritten; the SSOT is immutable here.
- Answer-key secrecy (charter + all three evodocs modules): the html practice projection carries prompts + options only; `correct_index`/`accept`/`answer` never enter the html or the initial client payload. `renderLessonHtml` structurally never reads `item.key`.
- JSONB-first practice: `renderLessonHtml` renders the practice section from `exercises` in the same pass, so re-rendering html does NOT drop the practice (unlike save-lesson's separate HTML-then-deck steps). No deck re-save is needed.
- DB access is server-only through the skill's `db.mjs` postgres client bound to `"stemrobin-schema"`; no browser/second client.
- `pdf = coalesce(new, old)` upsert semantics from save-lesson are preserved for the re-render.

## Confirmed Decisions

- polish-renderer → No renderer/template change; deliver by re-rendering the stale cache only.
- rerender-mechanism → New deterministic, idempotent `.agents/skills/sr-math-lesson/scripts/rerender-lessons.mjs` that reuses `renderLessonHtml`/`renderPdf` and reads JSONB from the DB; not routed through save-lesson's file+outline-check path.
- pdf-refresh → Re-render html AND best-effort pdf for all 16; coalesce pdf on failure.
- snapshot-scope → Snapshot html only (not pdf) before mutation.

## Compatibility And Regression Constraints

- `content`/`exercises`/overlay/`sr_content_ledger`/`sr_users` unchanged (verified: all 16 cards remain named; card+exercise counts intact).
- Re-rendered html stays a self-contained standalone document (same template), so any current consumer of `sr_lessons.html` keeps working.
- No new dependency (`playwright-core` already declared in `.agents/skills/package.json`).
- Idempotence: a second `--check` run must report 0 html changes.

## Open Questions

None.
