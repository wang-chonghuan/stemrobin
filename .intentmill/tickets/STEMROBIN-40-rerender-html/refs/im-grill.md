# IntentMill Grill

> Full delegation (seed STEMROBIN-39, prodfarm cap13 — no human). Blocking
> decisions are self-adjudicated from the charter + code/evodocs evidence and
> recorded with a declarative `final_decision`.

## Blocking Decisions

1.
- id: polish-renderer
- question: Should `render-lesson.mjs` / `lesson-template.html` CSS be polished for section numbering/naming/colour or the practice-section styling (ticket + seed G-C: "有可打磨处则打磨")?
- recommendation: No polish. Evidence: `renderCard` already renders a coloured `sr-sec-num` badge (`--sr-blue` background, white mono) + a display-font `sr-sec-name`, and `renderPractice` already renders a numbered `ol.sr-practice` with per-item `sr-ptype` tags and a note — the SAME template/CSS that produces the PDF, so the html is already number+name-bearing and PDF-consistent. Charter engineering-rules (Simplicity First, Surgical Changes) forbid restyling that isn't required. Every acceptance bullet is met by re-rendering alone.
- final_decision: No renderer/template change. The ticket is delivered by re-rendering the stale cache; the renderer is left byte-for-byte intact.

2.
- id: rerender-mechanism
- question: Re-render via a new DB-driven script, or by reusing `save-lesson.mjs`?
- recommendation: New script `scripts/rerender-lessons.mjs`. `save-lesson.mjs` requires on-disk content/exercises/overlay files and runs the human-outline fidelity check that the stage-2 ledger currently fails (evodocs known-limit) — irrelevant when re-deriving a cache from already-persisted, already-validated JSONB. The new script reads the JSONB from the DB and calls the SAME `renderLessonHtml`/`renderPdf`, so output is identical to a fresh save while staying SSOT-correct (derive the cache from the SSOT).
- final_decision: New deterministic, idempotent `rerender-lessons.mjs` reusing the canonical `renderLessonHtml`/`renderPdf`; do not route through save-lesson's file+outline path.

3.
- id: pdf-refresh
- question: Refresh the stored `pdf` too, or html only?
- recommendation: Refresh both. Acceptance wants the html to match the PDF look; the PDF is likewise a derived cache off the same stale JSONB era. `playwright-core` + cached chromium are already present (no new dependency). Use best-effort render + `pdf = coalesce(new, old)` so a render miss keeps the prior pdf.
- final_decision: Re-render html AND best-effort pdf for all 16; coalesce pdf on render failure. A `--no-pdf` flag exists for html-only reruns but the delivered run renders pdf.

4.
- id: snapshot-scope
- question: What to snapshot before mutating (reversibility)?
- recommendation: Snapshot each lesson's current `html` to `refs/html-snapshot/<id>.html` before writing. Do not snapshot pdf bytes (~25MB across 16 lessons would bloat committed refs, and pdf re-renders reproducibly from the same JSONB). html is the text artifact the ticket is defined against.
- final_decision: Snapshot html only, before mutation; pdf reproducible from JSONB.

## Recommended Defaults

- Build `meta` from the DB stage ledger (`entry.title`/`entry.genre`/`ledger.theme`/`entry.core_idea`), exactly as `save-lesson.mjs`, so a re-render is byte-identical to a fresh save.
- Iterate `sr_lessons where subject='math'` (16 rows); look each up in its stage ledger. Support `--id <id>` for single-lesson reruns and `--check` for a non-mutating dry-run diff.
- Verify empirically against the DB (psql/grep the stored html) plus a ticket-scoped pure unit test of the renderer invariants. Do not unit-test the shared-DB mutation itself.
- Distinguish answer-key DATA (`correct_index`/`"accept"`/`answer_text`) from the template's dormant `.sr-answer` CSS chrome when proving KEY-absence.

## Future Or Conditional Decisions

- STEMROBIN-41 will switch the full-text 速览 to consume this now-current stored `sr_lessons.html`; how the app frames that standalone document (its own `<head>`/KaTeX/comment chrome) is STEMROBIN-41's concern, not this ticket's.
- The stage-2 guide-vs-ledger outline discrepancy (evodocs known-limit) blocks a fresh `save-lesson.mjs` save but not this cache re-render; reconciling it is a separate content decision.

## Out-of-Scope Guardrails

- Do not modify `content`/`exercises` JSONB, the `zh` overlay, `sr_content_ledger`, or `sr_users`.
- Do not add a dependency; do not add a second renderer or DB client.
- Do not change the app (`app/src/**`) — surfacing the html as 速览 is STEMROBIN-41.
- Do not emit any answer KEY into the html; do not add a deck re-save step (JSONB-first render already includes the practice).
