# IntentMill Handoff

## Actual Changes

Database (Azure easy-app Postgres, schema `stemrobin-schema`):
- `ssot-schemas/db-schemas/stemrobin.sql` — rewritten for the easy-app Postgres with the
  four minimal tables `sr_users`, `sr_lessons` (html + pdf bytes), `sr_questions`,
  `sr_answer_events` (references only `question_id`; nullable `answer_blob_id`). Applied
  live; seeded `sr_users` row 1 (`edwinbiz@hotmail.com`, scrypt-hashed `123456`).

Server data layer (server-only):
- `src/lib/db.ts` — `postgres` client (reads `EASYAPP_DATABASE_URL` locally / `DATABASE_URL`
  in the Container App; `search_path=stemrobin-schema`).
- `src/lib/session.server.ts` — scrypt `verifyPassword`, HMAC `signSession`/`verifySession`,
  cookie helpers (isolated in `.server.ts` so crypto/cookie imports never reach the client).
- `src/lib/session.ts` — `getCurrentUser` / `login` / `logout` server functions.
- `src/lib/lessons.ts` — rewritten to Postgres: `getLesson`, `getLessonHtml` (iframe srcdoc),
  `getLessonPdf` (base64), `listLessonIds`.
- `src/lib/quiz.ts` — `getLessonQuestions` (no answers pre-sent) + `recordAnswer` (gated on
  login; returns verdict + correct index + answer for the post-answer reveal).
- Removed `src/lib/supabase.ts` and the `@supabase/supabase-js` dependency; added `postgres`.

UI:
- `src/components/quiz-drawer.tsx` (new) — bottom-sheet card quiz: one question per card,
  choice options with post-answer feedback + reveal, work cards show a camera placeholder,
  login gate, KaTeX rendering.
- `src/routes/_app/login.tsx` (new) — minimal email/password login page.
- `src/routes/_app/lesson.$id.tsx` — loads 課文 HTML from the DB (iframe `srcDoc`),
  downloads the PDF via a server fn + Blob, adds the “卡片答题” toolbar button + drawer.
- `src/routes/__root.tsx` — KaTeX CSS/JS (CDN) for math in the quiz.
- `src/styles/app.css` — quiz drawer + login styles (DESIGN tokens; reduced-motion; mobile
  full-width).
- `src/lib/curriculum.ts` — added `math-s3-03` id.

Authoring skill split:
- `.agents/skills/sr-lesson/scripts/save-lesson.mjs` — rewritten: targets the easy-app
  Postgres; 課文 save validates the five sections and rejects a `practice` section; a
  `--questions <json>` path validates + writes `sr_questions`.
- `.agents/skills/sr-lesson/SKILL.md` and `references/common/lesson-contract.md` — updated
  for the split (cap1 = 課文 five sections; cap2 = structured exercises; DB storage).

Data:
- Migrated 7 existing lessons (`math-s2-04..08`, `math-s3-01..02`) + 104 practice items into
  `sr_lessons` (html+pdf) / `sr_questions` (imported as `answer_mode='work'`) via the
  throwaway `.intentmill/.../tests/migrate-old-lessons.mjs`.
- Generated `math-s3-03` (等式两边同乘同除) through the split pipeline: 課文 (five sections)
  + 13 structured questions (11 choice + 2 work) → `sr_lessons` + `sr_questions`.
- Deleted `public/lessons/*` (retired; lessons are Postgres-only now).
- `.env` — added `EASYAPP_DATABASE_URL` (gitignored; not committed).

Tests: `tests/auth.test.ts`, `tests/db-model.test.ts`, `tests/vitest.config.ts`,
`tests/browser-render-check.mjs` (+ screenshots), `tests/test-results.md`.

## Spec And Plan Alignment

Implements `im-spec.md` and follows `im-plan.md`'s phase order. Contract coverage:
- Spec obligations: 4-table model, server-fn data access, 課文 in Postgres, cap split,
  bottom-drawer quiz with feedback+reveal, minimal login, answer-event tracking, one
  DB-backed delivery path, old-data migration, `math-s3-03` probe — all delivered.
- Critical existing contracts preserved: answers-hidden-in-print (reveal is React-only; the
  PDF/課文 carry no answers), DB-connection-string server-only (verified: absent from client
  bundle), one delivery path / one exercise SSOT (`public/lessons/*` removed;
  `sr_questions` is the quiz+practice source), independent-subagent+gate authoring
  (math-s3-03 authored by a subagent), DESIGN.md tokens, easy-app PG no-anon-REST
  (all access server-side), no schema/role re-provisioning.
- Non-scope/rejected options absent: no photo upload/blob store (only `answer_blob_id`
  column), no JWT/Clerk, no score aggregate columns, no Supabase tables, no `public`/r_*.

Deviations (still satisfy `im-spec.md`):
1. **Delivery mechanism** — lesson HTML is delivered via a server function into the iframe
   `srcDoc`, and the PDF via a base64 server fn + Blob download, instead of dedicated HTTP
   API routes. Still DB-only, server-side, single path, credential-isolated. Chosen for
   simplicity and to avoid API-route friction in this TanStack version.
2. **Old-lesson question mode** — migrated old items are imported as `answer_mode='work'`
   (faithful; no invented options), rather than generating choice options for all 104. The
   spec's plan phrased migration as “closed-form → choice with generated options, otherwise
   → work”; importing as work is the “otherwise” branch and keeps every lesson on the one
   model with a working quiz. `math-s3-03` (new pipeline) demonstrates the full choice
   experience. Generating misconception-grounded options for the old items is a follow-up
   (see Residual). This is a scope-honest choice, not a spec violation.
3. **Test runner** — the repo already had `vitest` configured (`test: vitest run`); used it
   (the draft’s “no runner” note was superseded by code).

## User Review Points

- Old lessons currently present their quiz as **work cards** (camera placeholder) because
  their imported items have no choice options yet; only `math-s3-03` shows the choice-card
  experience. This is a product-visible consequence of Deviation 2. It is non-blocking (the
  spec permits `work` mode and all data uses the one model), but you may want the old
  lessons’ options generated soon — see Residual. If you consider old lessons being
  work-only unacceptable for this ticket, that is the one point that would reopen scope.

## Residual Issues And Future Improvements

- Generate misconception-grounded **choice options** for the 104 migrated old-lesson
  questions (batch via cap2 / a subagent), upgrading them from `work` to `choice`.
- **Work-answer photo flow**: capture/upload, a blob store, and grading (the `answer_blob_id`
  column and work cards are pre-wired).
- **Clerk** full authentication replacing the minimal email/password login; set a real
  `SESSION_SECRET` in the deployed environment (currently a dev fallback).
- **Weakness analysis / lesson recommendation** from `sr_answer_events` (the reason answers
  are tracked).
- Physics-subject exercises; `sr_lessons.knowledge` extraction.
- Automated **print-isolation** snapshot test (currently covered by construction).
- Pre-existing stale `DESIGN.md` “Lesson Rendering” section left untouched (out of scope).
- Deploy note: run `n-easyapp cap2` to redeploy so the Container App serves this build; the
  easy-app Postgres already holds the migrated + new data.
