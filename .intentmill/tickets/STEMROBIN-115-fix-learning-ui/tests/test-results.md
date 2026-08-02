# Test Results

## Development Test Log

1. Ran the edition unit suite after extending numbered-subpart handling.
   - Command: `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'`
   - Result: 16 tests passed.
2. Ran `adapt-finalize` for all 16 generated 5m lessons and published all 16 through the canonical edition publisher.
   - Result: all lessons passed finalization; the database retained 285 answer keys.
3. Ran the ticket-scoped headed Playwright script against the production build at `http://127.0.0.1:3213`.
   - Server command: `cd app && PORT=3213 node --env-file=../.env .output/server/index.mjs`
   - Initial result: correctly exposed exercise 139 as an additional inline-numbering defect.
   - Rework: fixed the normalizer's Unicode `\w` false negative, re-finalized and republished all lessons.
   - Final result: both acceptance criteria passed.
4. Ran the app unit suite.
   - Command: `cd app && npm run test`
   - Result: 10 files, 73 tests passed.
5. Ran the production build.
   - Command: `cd app && npm run build`
   - Result: passed.
6. Re-ran the headed Playwright script against the fresh production build.
   - Server command: `cd app && PORT=3213 node --env-file=../.env .output/server/index.mjs`
   - Command: `node --env-file=.env .intentmill/tickets/STEMROBIN-115-fix-learning-ui/tests/learning-ui-check.mjs http://127.0.0.1:3213`
   - Viewports: 1280 x 800 and 390 x 844.
   - Result: passed.

## Coverage Map

### AC1

- Audited 16 generated lessons, 285 exercises, and 108 complete numbered-subpart exercises.
- Observed zero wrong-order or missing-line-break defects.
- At 1280 x 800, browser-opened exercise 1 and observed rendered order `1,2,3,4,5,6`.
- At 1280 x 800, focused the first answer field and observed the `更多` control selected.

### AC2

- Submitted one real wrong answer and observed the `/learn` card and database move from the baseline to `0 / 1`.
- Submitted the correct redo and observed the card and database move to `1 / 1`.
- Observed the mobile topbar remain at viewport top before and after scrolling.
- Observed content begin below the topbar and the final page controls remain fully reachable.

## Screenshots

- `screenshots/learn-mobile-wrong.png`
- `screenshots/learn-mobile-corrected.png`
- `screenshots/card-mobile-bottom.png`
- `screenshots/exercise-desktop-more.png`

## Cleanup

The Playwright script deleted the exact mistake and answer-event rows it created. No fixture data remained.
