# IntentMill Grill

## Blocking Decisions

None.

Rationale (prodfarm cap13 self-adjudication, no human, full charter delegation): the ticket goal — read-check + exercises are choice-only, reversibly, with existing `input` items re-authored to diagnostic choice — is fully specified and settled by the charter. No user-visible surface changes (the app already renders/judges choice; only the data mode flips). No new external interface, dependency, service, config, secret, or deployment change. The one empirical finding (exercises are ALREADY 100% choice; only 40 read-check `input` items exist) narrows the data work but confirms — does not contradict — the goal, so it needs no arbitration. Reversibility mechanism (a policy flag vs a validator constant) is pure implementation latitude. Answer-key secrecy and "never touch `sr_users`" are already binding charter rules, not open choices. Therefore no blocking human decision remains.

## Recommended Defaults

- Enforce choice-only through ONE reversible policy source (`scripts/question-policy.mjs`, `CHOICE_ONLY = true`) consumed by both validators; leave `validateItemKey`'s `input`/`work` branches, the schema's `input` mode, the app's `input` path, and the renderer's neutral projection untouched so re-enabling `input` is a one-line flag flip.
- Keep each of the 40 re-authored read-checks' prompts unchanged; add exactly 4 options (A/B/C/D), one correct, three distractors of the same surface form as the answer, each wrong for a nameable misconception (per SKILL.md commitment #4). No "无法确定 / 以上都不对", no meta-sentence 误区标签 options.
- Persist ONLY through the generator's deterministic path: `save-lesson.mjs` for content/exercises/zh + rendered html/pdf, `translate-lesson.mjs` (with the `check-i18n` gate) for the en overlay. No hand-written `sr_*` rows.
- Snapshot the 16 lessons' `content` + `exercises` + zh/en overlays before mutating, and emit a conversion summary (which items, per lesson, read-check vs exercises).

## Future Or Conditional Decisions

- Re-enabling `input` (fill-in-the-blank) later: flip `CHOICE_ONLY` to `false` and, if desired, backfill selected read-checks/exercises to `input`. Out of scope now; the policy switch exists to make it cheap.
- Removing the orphaned relational-model scripts (`scripts/choice-deck.mjs`, `scripts/backfill-choice-decks.mjs`) and/or the legacy `sr_questions` table: pre-existing dead code from the pre-0004 model; a separate cleanup, not this ticket.

## Out-of-Scope Guardrails

- No `app/` runtime code change (charter/ticket: the app already supports both modes). Backed by code fact: `app/src/lib/reading.ts` already projects read-checks KEY-free and server-judges both modes.
- No exercise data change (backed by DB fact: all 331 exercise items are already `choice`).
- No schema change; `input` stays a valid `mode` value (reversibility redline).
- No change to `sr_users`; `sr_content_answer_events` history for changed read-checks is disposable (charter-authorized).
- No mechanical "which is X?" conversions (ticket redline).
