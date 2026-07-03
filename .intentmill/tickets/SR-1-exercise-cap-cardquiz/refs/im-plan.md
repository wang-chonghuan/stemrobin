# IntentMill Plan

## Source Contract

`im-spec.md` is the only requirement contract for this ticket. `im-draft.md` and
`im-grill.md` are background provenance; every material constraint from them is already
promoted into `im-spec.md` and this plan. cap6 MUST NOT depend on rereading draft/grill
to discover requirements.

## Implementation Approach

Build in dependency order: data model → server data-access + auth → authoring-skill
split → lesson delivery move → card-quiz UI → old-data conversion → validation on
`math-s3-03`. Reuse existing modules and patterns:

- **DB schema**: rewrite the repo SSOT schema file to target the easy-app Postgres
  `stemrobin-schema` with the four tables from `im-spec.md` (`sr_users`, `sr_lessons`,
  `sr_questions`, `sr_answer_events`). Apply via `psql` using the easy-app connection
  string (server-only). **Connection-string source:** the easy-app Postgres URL is the
  `DATABASE_URL` the Container App already runs with (obtainable from `n-easyapp`
  cap2/cap1 "return" output for project `stemrobin`); cap6 adds it to the repo-root
  gitignored `.env` under an easy-app-specific key (e.g. `EASYAPP_DATABASE_URL`) for
  local authoring/migration. Do NOT re-provision the schema/role (n-easyapp cap1 already
  created them); only `CREATE TABLE`/seed. Seed the single preset `sr_users` row with a
  scrypt hash of `123456`.
- **Data access**: introduce TanStack `createServerFn` handlers (server-only) for:
  list lessons, get one lesson HTML, get lesson PDF bytes, list a lesson's questions,
  record an answer event, login, logout. Use a single shared Postgres client module
  reading the connection string from server env. Remove the browser Supabase client and
  the `stemrobin`-scoped Supabase usage.
- **Authoring split**: in `.agents/skills/sr-lesson`, change the existing capability to
  emit 課文 only (drop the `practice` section from its contract/template output) and add
  a new capability that consumes a lesson's 課文 and authors `sr_questions` + the rendered
  practice. Extend `scripts/save-lesson.mjs` to (a) not require the `practice` anchor for
  課文-only saves, (b) connect to the easy-app Postgres — replacing the current
  repo-root `.env` DB-URL read that is keyed on `SUPABASE_POOLER_URL`/`SUPABASE_DB_URL`
  with the easy-app key above — (c) upsert `sr_lessons` and, on
  the exercise path, insert `sr_questions`; keep PDF pre-generation. Preserve the
  independent-subagent authoring + gate-1 review discipline for both capabilities.
- **Lesson delivery**: change `src/routes/_app/lesson.$id.tsx` so the iframe `src` (and
  the toolbar PDF link) resolve to server fn/route URLs backed by Postgres instead of
  static `public/lessons/*`; keep the `body.scrollHeight` auto-height and toolbar
  behavior. Remove the static files once the DB path serves all lessons.
- **Login**: add a login route/page and a session module that sets/reads a signed
  httpOnly cookie carrying `user_id`; gate quiz/answer-write server fns on it.
- **Card-quiz UI**: add a bottom-drawer component launched from the lesson toolbar,
  reading questions via the questions server fn and posting answers via the answer-event
  server fn; style with `--sr-*` tokens in `src/styles/app.css`; per D5 sizing and
  reduced-motion.
- **Old-data conversion**: a one-off throwaway script/subagent parses each existing
  `public/lessons/<id>.html` into a `sr_lessons` row (課文 HTML) + `sr_questions` rows
  (from its practice `<li>`/`.sr-ptype`/`.sr-answer`), assigning `answer_mode` and, for
  closed-form items, generating options. Spot-check output; then retire static files.
- **Validation**: run the split caps to generate `math-s3-03`; delete + regenerate if the
  gate or a spot-check finds it poor.

## Implementation Drift Controls

- The **answers-hidden-in-print** contract cannot be bypassed: the quiz's post-answer
  reveal is in-app only; the PDF MUST keep `.sr-answer` hidden. Do not leak the reveal
  into the print path.
- The **DB connection string is server-only**: never import it into client code or a
  browser-reachable module. Every lesson read and answer write goes through a
  `createServerFn` handler. A choice that would expose it to the browser is disallowed.
- **One delivery path**: after conversion, no lesson may be served from a static file or
  Supabase. Do not leave a fallback that reads `public/lessons/*` — remove it.
- **One exercise SSOT**: the rendered practice HTML/PDF for a lesson MUST derive from the
  same `sr_questions` data the quiz uses; do not maintain a second independently-authored
  copy.
- **Preserve authoring discipline**: both `sr-lesson` capabilities keep independent-subagent
  authoring + a gate before persistence; persistence only via the deterministic saver, no
  hand-written DB rows.
- **DESIGN.md discipline**: only `--sr-*` tokens/three colors; green = correct; lucide
  icons; reduced-motion respected. No new hues, no celebratory UI.
- **Minimal-auth honesty**: password stored as a scrypt hash, cookie httpOnly; do not
  present this as complete auth, do not add JWT/Clerk.
- **No scope creep**: rejected/out-of-scope items MUST NOT appear — no photo
  capture/upload/blob store/grading, no score aggregates, no Supabase tables, no `public`
  / `r_*` access, no re-provisioning of the easy-app schema/role, no fix of the stale
  DESIGN.md section, no physics.
- **Fail fast**: if the easy-app Postgres or its connection string is unavailable at
  implementation time, stop and record it in `im-handoff.md` — do not silently fall back
  to Supabase or static files.

## Phases

1. **Schema + seed.** Rewrite the SSOT schema file for `stemrobin-schema` with the four
   tables; apply via `psql` on the easy-app connection; seed the preset `sr_users` row
   (scrypt hash). Verify: tables exist; `sr_users` has `user_id=1` with a non-plaintext
   hash; FKs enforce `question_id`→`sr_questions`, `lesson_id`→`sr_lessons`.
2. **Server data-access + session.** Add the shared Postgres client (server-only) and
   `createServerFn` handlers: lessons list, lesson HTML, lesson PDF, questions,
   record-answer, login, logout. Add the signed httpOnly `user_id` cookie session and
   gate record-answer/quiz on it. Remove the browser Supabase client. Verify: handlers
   run server-side; the connection string is absent from the client bundle (grep build
   output); unauthenticated answer-write is rejected.
3. **Authoring split + saver.** Change the existing `sr-lesson` capability to 課文-only
   (no `practice`); add the new exercise capability; extend `save-lesson.mjs` (drop
   mandatory `practice` anchor for 課文 saves, target easy-app PG, upsert `sr_lessons` +
   insert `sr_questions`, keep PDF gen). Regression: the saver's other validations
   (KaTeX wiring, DESIGN tokens, no leftover placeholders) still run; both capabilities
   still route through independent-subagent + gate. Verify on a scratch lesson: 課文 save
   writes `sr_lessons.html`; exercise save writes `sr_questions` with valid
   options/`correct_index`.
4. **Lesson delivery move.** Point `lesson.$id.tsx` iframe `src` + PDF link at the server
   fn/route; keep `body.scrollHeight` auto-height and toolbar behavior. Regression: back
   button, title (`getLessonLabel`), PDF download, and iframe sizing still work; the
   lesson renders identically to the static version. Remove `public/lessons/*` only after
   the DB path serves all lessons (post Phase 6).
5. **Card-quiz drawer.** Build the bottom-drawer quiz launched from the toolbar button:
   one `sr_questions` card per `ord`; choice cards render options, record an answer event
   on selection, then show correct/incorrect (green) + reveal `answer`; work cards show
   the lucide `Camera` placeholder. Style with `--sr-*`; D5 sizing (desktop not
   full-w/full-h, mobile full-width); reduced-motion disables the slide animation.
   Verify: choice selection writes one `sr_answer_events` row with correct `is_correct`;
   work cards write nothing; reveal never appears in the PDF.
6. **Old-data conversion.** Run the throwaway tool to migrate every existing lesson into
   `sr_lessons` + `sr_questions`; spot-check a converted lesson (課文 intact, questions
   carry item text/answer, `answer_mode` correct). Then retire static `public/lessons/*`.
   Verify: every previously-static lesson loads via the DB path; no static/Supabase read
   remains.
7. **Validation on `math-s3-03`.** Generate 等式两边同乘同除 end-to-end via the split
   caps; run gate-1; spot-check math correctness and the quiz. Delete + regenerate if
   poor. Verify: `math-s3-03` appears via the DB path with a working card-quiz.

## Unit Test Plan

Ticket-scoped tests live under `im tests path`
(`.intentmill/tickets/SR-1-exercise-cap-cardquiz/tests`). No test runner is configured
yet; select a lightweight runner compatible with the Vite/TanStack app (e.g. Vitest) and
use Playwright (repo already depends on `playwright-core`) for browser flows. High-risk
assertions, not only happy path:

- **Data shape**: a generated/converted `sr_questions` row for `answer_mode='choice'` has
  a non-empty `options`, exactly one `correct_index` in range, and a non-empty `answer`;
  a `work` row has null `options`/`correct_index`.
- **Answer event write**: recording a choice answer inserts exactly one `sr_answer_events`
  row referencing the right `question_id`, with `is_correct` matching `chosen ==
  correct_index` and `answer_blob_id` null; a wrong answer is retrievable by a
  per-learner query (weakness-traceability assertion).
- **Auth gate**: the record-answer server fn rejects an unauthenticated request and
  accepts a request carrying the valid `user_id` cookie; login rejects a wrong password
  and accepts the preset credentials; the stored password is a scrypt hash, not `123456`.
- **Credential isolation**: the built client bundle does not contain the Postgres
  connection string (static grep assertion).
- **Delivery path**: the lesson HTML server fn returns the stored 課文 for an existing
  (migrated) lesson id; no code path reads `public/lessons/*` after Phase 6.
- **Print isolation**: the PDF/print output for a lesson contains no revealed answer text
  (the reveal is in-app only).
- **Quiz interaction (Playwright)**: opening the drawer shows one card per question in
  `ord`; selecting a choice option shows correct/incorrect + the answer and writes an
  event; a work card shows the camera placeholder and writes nothing; the drawer is not
  full-height/width on desktop and full-width on mobile.
- **Saver regression**: a 課文-only save no longer fails on the missing `practice` anchor
  but still fails on missing KaTeX wiring / DESIGN tokens / leftover placeholders.

If a high-risk behavior cannot be unit-tested in cap6 (e.g. the LLM authoring quality),
cover it with the authoring gate + a documented manual spot-check rather than asserting
exact generated content.

## Handoff Expectations

After development, cap6 MUST write `im refs path/im-handoff.md` summarizing actual changes
at feature/module/file granularity, stating any divergence from `im-spec.md`/`im-plan.md`
and why, listing missed user-review points that should have been grilled earlier, and
recording residual issues or future improvements (e.g. the work-answer photo/blob flow,
Clerk auth, weakness-analysis recommendation, physics). If the easy-app Postgres or its
connection string is unavailable, that MUST be recorded as a blocker in the handoff, not
worked around with Supabase or static files. Do not return to cap4 for new decisions.
