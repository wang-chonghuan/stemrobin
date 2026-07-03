# Unit Test Results

## Commands Run

- `npm run build` — production build (server + client bundles). Result: **pass**.
- `npx vitest run --config .intentmill/tickets/SR-1-exercise-cap-cardquiz/tests/vitest.config.ts`
  — ticket-scoped unit + integration suite. Result: **2 files, 7 tests, all pass**.
- Dev server: `npm run dev -- --host 127.0.0.1 --port 3100` (port 3000 was occupied by
  another checkout; actual port **3100**).
- `npx playwright install chromium` — needed (installed Chromium headless-shell 148).
- `node .intentmill/tickets/SR-1-exercise-cap-cardquiz/tests/browser-render-check.mjs http://127.0.0.1:3100`
  — ticket Playwright browser check. Result: **RESULT: PASS (12/12 assertions)**.
- One-off data migration: `node .intentmill/tickets/SR-1-exercise-cap-cardquiz/tests/migrate-old-lessons.mjs`
  — migrated 7 existing lessons + 104 questions into Postgres.
- Credential-isolation static grep over the built client bundle (see Coverage Map).

## Results

- Build: pass (server bundle contains `postgres.mjs`; client bundle does not).
- vitest: `auth.test.ts` (4) + `db-model.test.ts` (3) = 7 passed.
- Playwright: 12/12 assertions pass (desktop 1280×800 + mobile 390×844).
- Credential isolation: no `EASYAPP_DATABASE_URL` / `pg-easyapp-shared` / password /
  `scryptSync` string found in any `.output/public/**/*.js`.

## Development Test Log

1. **External skeleton (Azure PG)** — connected via `psql` + the `postgres` driver;
   verified schema `stemrobin-schema`, DDL perms, `search_path`, seeded user read, and
   scrypt verify (123456 ✓ / wrong ✗) before building on it.
2. **Schema + seed** — applied `ssot-schemas/db-schemas/stemrobin.sql`; verified 4 tables
   exist and `sr_users` row 1 has a non-plaintext hash.
3. **DB/auth layer** — added `db.ts`, `session.server.ts`; wrote `auth.test.ts` +
   `db-model.test.ts`; ran vitest → pass.
4. **Build + credential isolation** — `npm run build`; grepped client bundle → no secret.
5. **Delivery + quiz UI** — wired `lesson.$id.tsx` (srcdoc from DB, base64 PDF), the quiz
   drawer, and login; rebuilt; then Playwright verified render + quiz flow.
6. **Old-data migration** — ran the throwaway migrator; spot-checked parsed questions.
7. **New pipeline probe** — generated `math-s3-03` (課文 + 13 structured questions) via
   the split caps + saver; verified rows; Playwright exercised its choice cards.

## Coverage Map

Each `im-plan.md ## Unit Test Plan` item →

- **Data shape (choice/work)** → `db-model.test.ts` "sr_questions data shape" (choice:
  options non-empty, exactly one in-range `correct_index`; work: null options).
- **Answer event write + traceability** → `db-model.test.ts` "answer-event traceability"
  (insert a wrong choice answer for learner 1, retrieve it via a per-learner wrong-answer
  query, clean up).
- **Auth gate** → Playwright "unauthenticated quiz shows login prompt" + "login with preset
  credentials succeeds"; password-hash + tamper covered by `auth.test.ts`; stored hash is
  scrypt (not `123456`) asserted in both `auth.test.ts` and `db-model.test.ts`.
- **Credential isolation** → static grep over `.output/public/**/*.js` (Results); server
  bundle has `postgres.mjs`, client has none.
- **Delivery path** → Playwright "lesson iframe renders content from DB (len=3679)";
  `public/lessons/*` deleted and no `src` code reads it (grep clean).
- **Print isolation of the reveal** → the quiz reveal is React-only; the PDF is generated
  from the 課文 HTML which has no answers; questions/answers live in `sr_questions`, never
  in the PDF path. (Static/contract check; no automated print test — see Notes.)
- **Quiz interaction (Playwright)** → prompt visible, options shown, feedback + reveal on
  answer, exactly one green correct option, work card camera placeholder, mobile full-width.
- **Saver regression** → the 課文 save rejected a file containing a practice section
  (caught during dev; fixed the false-positive on the CSS rule) and still requires the five
  section anchors; math-s3-03 課文 saved only after passing validation.

## Failures

- (Fixed during dev) The practice-section check in both the migrator and `save-lesson.mjs`
  first matched the CSS rule `section[data-sr-section="practice"]` in `<style>`; changed to
  match the actual `<section data-sr-section="practice"` element. Re-ran → correct.
- No open failures.

## Notes

- Playwright ran on Chromium **headless-shell** (installed via `npx playwright install
  chromium`); the script attempts `headless:false` first and falls back. Assertions are
  real in-browser facts (render, interaction, layout, screenshots), captured at
  `screenshots/desktop-quiz.png` and `screenshots/mobile-quiz.png`.
- Print-isolation is covered by construction (answers are not in the 課文 HTML nor the PDF
  path) rather than an automated print test; a headless print snapshot is a possible future
  hardening.
- Integration tests hit the real Azure easy-app Postgres (this stage has a single shared
  dev DB and no separate test DB); the answer-event test inserts then deletes its row.
