# Capability 1 — Author a stage's concept ledger

Produce or revise `resources/content/math-ledger/stage-<n>.json` — the machine-readable outline that everything else builds on. Read `references/common/lesson-contract.md` (The ledger) first.

**Execution:** an independent subagent authors the ledger from the matching stage in `resources/content/course-gen-guide-math.md`, official guideline docs, the learner's known state, and the contract. The orchestrator runs `scripts/check-outline.mjs`, `scripts/check-ledger.mjs`, then gate-1, then commits the file.

## How to slice a stage (this is the craft)

1. **Name the stage's ONE model first** (`model` field). Everything in the stage must be expressible in it. If you cannot state it in one sentence, the stage is cut wrong.
2. **Copy the human outline before expanding it.** Verify every lesson's order, title, and direction against `resources/content/course-gen-guide-math.md`. Pedagogical expansion is allowed only after this correspondence is explicit; silently retitling or replacing an outline lesson is a failure.
3. **Inventory the vocabulary** the stage's procedures will need. Every term someone will *use* must be *taught* — that's what `introduces`/`consumes` encode. Cluster heavy vocabulary into dedicated 概念课 placed BEFORE the 方法课 that consume them.
4. **Slice by installable idea, not by textbook chapter.** Merge lessons that are one move (同类项+合并 = one lesson: recognize-then-do). Split lessons that install two ideas. Do not copy mainstream pacing — this learner is prerequisite-gated, not age-gated.
5. **Declare `assumed` honestly.** Terms from earlier stages go in `assumed` with `from`; real curriculum gaps get `"from": "GAP"` + note so the debt is visible.
6. **Commit boundary cases per lesson** — the edge instances that force real categories. These are contracts for cap2/cap3.
7. Every lesson gets `core_idea` — one sentence. If it needs two sentences, split the lesson.

## Output & checks

- Write the JSON to `resources/content/math-ledger/stage-<n>.json` (create the dir if needed).
- Run `node .agents/skills/sr-math-lesson/scripts/check-outline.mjs resources/content/course-gen-guide-math.md --ledger resources/content/math-ledger/stage-<n>.json` — must pass (every guide title remains in order; prerequisite anatomy lessons may be inserted).
- Run `node .agents/skills/sr-math-lesson/scripts/check-ledger.mjs resources/content/math-ledger/stage-<n>.json` — must pass (schema + closure + uniqueness).
- Then gate-1 (independent reviewer). Confirm the human outline title/order and `app/src/lib/curriculum.ts` title/order remain aligned; availability links are DB-driven and require no manual id edit.

Revising an existing ledger (adding/renaming lessons) follows the same path; ids of already-generated lessons must not be reused for different content unless those lessons' rows are deliberately replaced.
