# IntentMill Plan

## Source Contract

`im-spec.md` is the implementation contract.

## Implementation Approach

- Edit `resources/content/math-ledger/stage-3.json` so `math-s3-01` aligns to `未知数是什么` and supports later lessons' consumed terms.
- Update `app/src/lib/curriculum.ts` title and introduce deterministic id/availability helpers that filter by database ids.
- Update app route loaders/components to pass database lesson ids to catalog, overview, labels, and navigation.
- Strengthen `save-lesson.mjs`: mandatory `--ledger`, metadata validation against ledger, deck validator before SQL, self-contained practice CSS.
- Update `sr-math-lesson` references so future generation starts from human outline -> ledger and save examples include ledger.
- Author new `math-s3-01.html` and `math-s3-01.questions.json` in ticket refs; validate and persist through the repaired scripts.

## Implementation Drift Controls

- Do not use the current stored 3.1 as generation input.
- Do not add manual `id` flags as a second availability source.
- Do not weaken validation to warnings.
- Do not embed answer keys in generated practice HTML.
- Keep changes surgical to math 3.1, skill validation, and dynamic availability.

## Phases

1. Code/ledger/app/skill validation changes.
2. Focused tests for helper contracts and saver contracts.
3. Fresh 3.1 HTML/deck authoring and validation.
4. Persistence to DB and browser verification.
5. Handoff and ticket closure evidence.

## Unit Test Plan

- Curriculum helper tests for sparse availability and labels/navigation.
- Saver contract tests for mandatory ledger, metadata mismatch, practice CSS, and invalid deck pre-write failure.
- Existing app unit tests and production build.
- Browser check for `3.1 未知数是什么`, catalog link, navigation, and practice styling at desktop and mobile.

## Handoff Expectations

- Record persistence commands and database outcome.
- Record generated content file paths and validation commands.
- Record test/build/browser verification results.
