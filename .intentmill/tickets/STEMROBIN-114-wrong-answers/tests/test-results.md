# Test Results

## Development Test Log

1. `node .intentmill/tickets/STEMROBIN-114-wrong-answers/tests/apply-mistakes-schema.mjs`
   - Passed after the schema slice was implemented.
   - Applied the marker-bounded block twice, checked metadata and existing row counts, and proved transaction rollback on a forced second-write failure.
2. `cd app && npm run test`
   - Passed: 72 tests.
   - Included the new shelf-authority book lookup cases, the product
     persistence helper's transaction branches, and the existing application
     unit suite.
3. `cd app && npm run build`
   - Passed.
   - Regenerated and type-checked the route tree with `/mistakes`.
4. `cd app && PORT=3212 node --env-file=../.env .output/server/index.mjs`
   - Started the built application at `http://127.0.0.1:3212`.
   - An initial `npm run start` attempt lacked runtime database environment
     variables and returned HTTP 500. It was stopped and restarted with the
     ignored root env file; no product-code workaround was added.
5. `node .intentmill/tickets/STEMROBIN-114-wrong-answers/tests/wrong-answers-check.mjs http://127.0.0.1:3212`
   - Passed in headed Chromium against the built application and real database.
   - Covered desktop `1360x900` and mobile `390x844`.
   - Captured desktop notebook, exact redo target, and mobile notebook screenshots.
   - Screenshots:
     - `.intentmill/tickets/STEMROBIN-114-wrong-answers/tests/screenshots/mistakes-desktop.png`
     - `.intentmill/tickets/STEMROBIN-114-wrong-answers/tests/screenshots/redo-target-desktop.png`
     - `.intentmill/tickets/STEMROBIN-114-wrong-answers/tests/screenshots/mistakes-mobile.png`
6. `cd app && E2E_BASE_URL=http://127.0.0.1:3212 npx playwright test tests/scroll-restoration.spec.ts --project=chromium --reporter=line`
   - Passed on desktop and mobile cases.

## Coverage Map

- Durable schema shape and idempotent application: `apply-mistakes-schema.mjs`.
- No mutation of existing rows during schema application: `apply-mistakes-schema.mjs`.
- Atomic answer-event plus mistake write rollback: `apply-mistakes-schema.mjs`.
- Product write-path transaction composition and correct-answer branch:
  `app/src/lib/textbook-answer.test.ts`.
- Shelf-authoritative book lookup and unknown-card behavior: `app/src/lib/textbooks.test.ts`.
- AC1, authenticated wrong submission and UTC date-grouped notebook row: `wrong-answers-check.mjs`.
- AC2, exact exercise redo, successful resubmission, and retained history: `wrong-answers-check.mjs`.
- Desktop and mobile UI rendering: ticket screenshots from `wrong-answers-check.mjs`.
- Ordinary page/card scroll behavior: existing `tests/scroll-restoration.spec.ts`.
- Initial answer-key secrecy: implementation inspection confirmed no expected answer value or accepted form was added to route data, DOM attributes, or browser payloads.

## Result

Pass. No unresolved test failure or environment blocker remains.
