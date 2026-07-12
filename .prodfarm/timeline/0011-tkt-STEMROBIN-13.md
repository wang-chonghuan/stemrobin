---
id: 0011
type: tkt
author: machine
date: 2026-07-12
---

# 0011 tkt STEMROBIN-13

- kind: tkt
- ticket: STEMROBIN-13
- type: story
- batch: 0003-math-choice-exercises
- merge_commit: 320796d2d8744c22356a98f49876e507a41615fd
- seed: STEMROBIN-12
- consumes: []

## Background

Saved math lessons mixed choice, typed-input, and open-response exercises even
though the learner-facing lesson, PDF, and card quiz all derive from the same
deck. The human requested a math-only conversion to choice questions, retaining
the existing wording and order while deleting answer history rather than
migrating it.

## Decision

Make the math generation contract choice-only and backfill the 11 saved decks
through the existing saver. Require at least three distinct options and one
valid correct index, allow more than four options, and constrain the migration
route to an immutable stored-deck snapshot. Preserve shared story question
behavior and the answer-key secrecy boundary.

## Consequences

All 233 math questions now have choice options and one key; 11 have five or
more options. Embedded practice and PDFs were regenerated from those decks.
Existing math answer events and attempts are empty. PR #5 merged this delivery
as `320796d`, deployed it in revision `ca-stemrobin--0000022`, and live browser
verification confirmed five-option rendering, choice scoring over 20 questions,
and no pre-answer key exposure.

## Proxy decisions

None. All relevant scope and data-retention choices were explicitly made by the
human at seed release.
