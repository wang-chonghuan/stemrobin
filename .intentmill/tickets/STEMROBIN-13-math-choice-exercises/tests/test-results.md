# Unit Test Results

## Commands Run

- `node .intentmill/tickets/STEMROBIN-13-math-choice-exercises/tests/choice-deck.test.mjs`
- `cd app && npm run test`
- `cd app && npm run build`
- `set -a; source .env; set +a; node .intentmill/tickets/STEMROBIN-13-math-choice-exercises/tests/browser-choice-quiz.mjs http://127.0.0.1:3001`
- `cd app && E2E_BASE_URL=http://127.0.0.1:3001 npx playwright test tests/lesson-regeneration.spec.ts --project=chrome --reporter=list`
- Database verification through `psql "$EASYAPP_DATABASE_URL"` for math deck shape and cleared history.

## Results

- Ticket deck check passed: accepts valid choice decks; rejects non-choice items; verifies distinct options, one valid key, and immutable prompt/order metadata.
- App unit suite passed: 16 tests in 2 files.
- Production build passed.
- Ticket browser script passed in headed Chrome against the production build at `http://127.0.0.1:3001`.
- Existing lesson regeneration Playwright suite passed: 2 desktop/mobile tests.
- Database verification after backfill: 233 math questions; 0 non-choice; 0 invalid choice rows; 11 questions with 5 or more options; 0 `sr_answer_events`; 0 `sr_quiz_attempts`.

## Development Test Log

1. Updated the math exercise contracts, checker, saver, and legacy math saver; ran the focused deck test and script syntax checks.
2. Added the constrained existing-deck backfill route, ran the backfill for all 11 saved math lessons, then queried the shared database for mode, option, immutable metadata, and history-cleanup results.
3. Extended the embedded-practice Playwright test, then ran the app unit suite and production build.
4. Started the built server with `set -a; source ../.env; set +a; PORT=3001 HOST=127.0.0.1 npm run start`; ran headed desktop/mobile browser checks and saved screenshots.
5. Re-ran the existing lesson regeneration browser suite and deleted the dedicated test user's temporary attempts. Final shared-history counts are zero.

## Coverage Map

- Choice-only validation, option uniqueness, valid correct index, input/work rejection, and prompt/order preservation: `choice-deck.test.mjs`.
- Future generator contract, 3-or-more options, and arbitrary option labels: `check-exercises.mjs` / `save-lesson.mjs` checks exercised by `choice-deck.test.mjs`.
- All current saved math decks, five-or-more options, and answer-history deletion: database verification query after `backfill-choice-decks.mjs --apply`.
- Embedded practice contains at least three options per item, includes a five-or-more-option item, has no answer-key data, and fits desktop/mobile: `app/tests/lesson-regeneration.spec.ts`.
- Logged-in choice answer, score denominator `20`, initial question-payload secrecy, mobile five-option card, and screenshots: `browser-choice-quiz.mjs`.
- Story `work` cards remain on the original non-scored branch without the math attempt end control: `browser-choice-quiz.mjs`.

## Failures

None in the final run.

## Notes

- Browser evidence uses headed Chrome. Screenshot paths:
  - `.intentmill/tickets/STEMROBIN-13-math-choice-exercises/tests/screenshots/practice-desktop.png`
  - `.intentmill/tickets/STEMROBIN-13-math-choice-exercises/tests/screenshots/quiz-desktop.png`
  - `.intentmill/tickets/STEMROBIN-13-math-choice-exercises/tests/screenshots/quiz-mobile.png`
- The ticket worktree locally symlinks `app/node_modules` to the shared checkout. Vite dev SSR resolves that symlink's original path, so browser verification used the successfully built production server instead. This is a local worktree setup limitation, not a shipped-product issue.
