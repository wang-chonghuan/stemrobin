# Gate 1 — Stage ledger

Run after cap1, before any cap2/cap3 authoring. Independent subagent (producer ≠ reviewer), given the ledger JSON, the contract, and the stage's raw guideline docs.

## First cause

If lessons are generated from this ledger, will the learner ever hit a sentence he cannot parse because a word was never taught — or a procedure whose *objects* he cannot name? If yes, the ledger fails.

## Checks (fail on any)

- **Closure holes** beyond what `check-ledger.mjs` catches mechanically: a 方法课 whose explanation will *obviously need* a term nobody introduces (simulate writing the lesson's key sentence — can it be said with only taught terms?).
- **Vocabulary smuggling**: heavy new vocabulary assigned to a 方法课 instead of its own preceding 概念课.
- **Model missing or fake**: `model` absent, vague, or not actually load-bearing for the lessons.
- **Wrong slicing**: a lesson installing two ideas; two lessons that are one move; textbook-inertia slicing that recreates the mainstream fragmentation this skill exists to avoid.
- **Boundary cases thin**: a 概念课 with fewer than 2 committed boundary cases, or boundary cases that are not genuinely edge instances.
- **Silent gaps**: `assumed` items that are neither prior-stage terms nor flagged GAPs.
- **Order errors**: a lesson consuming a term introduced later (script catches literal cases; judge intent too).

## Pass

Every lesson's key sentences can be written with only taught/assumed terms; concepts precede the methods that use them; slicing is one-idea-per-lesson; gaps are visible. Then cap2/cap3 may author against this ledger.
