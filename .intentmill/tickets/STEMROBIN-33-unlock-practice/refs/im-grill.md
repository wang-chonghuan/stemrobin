# im-grill — STEMROBIN-33 · unlock-practice

Mode: cap13 self-adjudication from charter (no human, full delegation, seed STEMROBIN-32).

## Blocking decisions

### G-1 — Unlock the 课后题 entry (do not gate on reading)
- Question: should the practice button open the drawer regardless of card-reading
  progress?
- Charter/seed adjudication: RESOLVED YES. The seed intent is explicit: 课后题
  随时可打开作答, not locked by unfinished 课文. Charter goal (serious training,
  learner autonomy) supports letting the learner practice on demand. STEMROBIN-22's
  gate is reversed here intentionally.
- Decision: remove the "locked until all cards read" gate on the practice entry.

## Recommended defaults (non-blocking)
- D-1: Keep the in-reader `showDone` "进入练习题" convenience button — it is a
  harmless shortcut, still valid after unlocking. Adjudicated: KEEP.
- D-2: Dead i18n key `lesson.practice.locked` — remove for cleanliness (both zh/en).
  Adjudicated: REMOVE (no runtime reference remains).

## Future / conditional
- F-1: If a future ticket wants a soft "you haven't finished reading" hint on the
  practice drawer, that is a separate nicety — out of scope now.

## Out-of-scope guardrails
- Do NOT change practice judging, question modes, or answer-key secrecy.
- Do NOT make opening/answering practice grant the 课文 (reading) point.
- Do NOT touch `sr_users`. No new dependency. `app/` only.

## Grill-leak check
No unresolved blocking decision remains. G-1 fully answered by seed; D-1/D-2
self-adjudicated. Proceed to spec/plan.
