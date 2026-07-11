# STEMROBIN-6 Test Results

## Content and Skill Gates

- Passed: `check-outline.mjs` confirms stage 3 retains all 10 human-guide lessons in order and `math-s3-01` is `未知数是什么`.
- Passed: `check-ledger.mjs` confirms stage 3 prerequisite closure, term ownership, and the 3.1 later-vocabulary slice.
- Passed: `check-exercises.mjs` confirms 20 contiguous items with `指认 7 / 操作 6 / 辨错 3 / 说理 4` and `choice 7 / input 9 / work 4`.
- Passed after independent re-review: the concept model explicitly places `$x-3=8$` on the two sides of an equality, connects the later legal transformations, and has positive/negative model examples.
- Verified failure before DB mutation:
  - missing `--ledger`;
  - lesson metadata title mismatch;
  - invalid one-item deck;
  - outline-title drift.

## App Verification

- Passed: `npm run test` in `app/` — 16 Vitest assertions.
- Passed: `npm run build` in `app/`.
- Passed: `E2E_BASE_URL=http://localhost:3010 npx playwright test tests/lesson-regeneration.spec.ts --project=chrome --reporter=list`.
  - system Chrome, per `.autoqa/` convention;
  - catalog shows and links `3.1 未知数是什么`;
  - lesson heading and practice section show 20 items;
  - 3.1 practice CSS shape matches 2.7;
  - no `answer`, `correct_index`, or `accept` leaks into lesson HTML;
  - 390px app and lesson iframe widths do not overflow.
- Desktop and mobile practice screenshots were captured by the passing Playwright run and visually inspected.

## Persistence

- `math-s3-01` upserted as draft with title `未知数是什么`.
- Saved deck replaced `sr_questions` with 20 items and injected the generated practice section.
- Stored HTML is 19,875 bytes; regenerated PDF is 1,627,866 bytes.

## Existing Debt Surfaced by the New Gate

`check-outline.mjs` intentionally rejects the pre-existing stage-2 ledger because it has already drifted from the human course guide. No stage-2 content was changed in this ticket. Any future stage-2 regeneration must first align that ledger to the guide rather than bypassing the gate.
