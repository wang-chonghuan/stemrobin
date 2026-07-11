---
name: sr-math-lesson
description: Load when the user asks to build StemRobin math lessons — generate a stage's outline ledger (概念台账), author one lesson's 課文 HTML, author its exercise deck JSON, or persist lesson+deck to the DB — or says "sr-math-lesson cap1/2/3/4", "生成数学大纲", "生成数学课", "重新生成某一课". Replaces sr-lesson for math. Model-first pedagogy: concept ledger, prerequisite closure, recall-first exercises, baked-in spaced review.
---

# sr-math-lesson

Build StemRobin math lessons for a young, high-comprehension learner (~8yo doing 12+ content). This skill exists because the previous generation failed in a specific, diagnosed way: procedures were teachable but the **conceptual vocabulary was never a teaching target**, prerequisites silently broke (lessons used terms no lesson ever taught), and exercises drilled only the current lesson's procedure via recognition. The learner could compute but could not name or parse what he was computing on.

The fix is structural, not stylistic. Read `references/common/lesson-contract.md` before any capability — it is the SSOT for the pedagogy, the ledger, the lesson genres, the exercise deck model, and the DB shape.

## Design commitments (why this skill is shaped this way)

1. **Human outline, then ledger, then lessons.** Start from `resources/content/course-gen-guide-math.md` and preserve its stage, lesson order, title, and instructional direction unless a human explicitly changes the outline. A stage's machine-readable 概念台账 then expands that outline: every lesson declares what terms it `introduces` and `consumes`. A script enforces **prerequisite closure** — no lesson may use a term no earlier lesson taught. This is what mechanically prevents the 去括号-uses-因子-nobody-taught failure.
2. **Model first.** Every stage has ONE central mental model (e.g. 代数式 stage: *式子是一棵两层的树*). Concepts are names for parts of the model; procedures are moves on the model. Lessons teach the model, then the moves.
3. **Concepts get their own lessons.** 概念课 is a first-class genre whose goal is naming/parsing fluency, with instances, non-instances, and boundary cases — not a definition paragraph inside a procedure lesson.
4. **Recall over recognition.** Exercise decks prefer `input` (type the answer) over `choice`. Choice is reserved for discrimination tasks (辨错).
5. **Review is baked in.** Every deck carries 复习 items targeting terms from earlier lessons (per the ledger), so spaced repetition happens without any runtime scheduler.
6. **Boundary cases are mandatory.** A pattern-matching child only forms real categories when forced through edge instances (−x 的系数、常数项、单独一个字母是不是单项式).

## Who does what

- **Lesson text is the semantic center.** cap2 uses independent authors and a producer-distinct reviewer. For a group of lessons, author one HTML file per lesson in parallel, then give the whole group to one independent reviewer; it returns a separate pass/fail verdict per lesson. Revisions go back to the owning author and only revised lessons are re-reviewed.
- **Decks are fast, deterministic work.** After a lesson passes gate-2, its author may create the cap3 deck. `check-exercises.mjs` and the saver are the blocking deck checks; do not dispatch a separate semantic deck reviewer unless the user explicitly asks for a deck audit or a previous deck caused an answer-quality incident.
- **Scripts do the deterministic work**: `scripts/check-outline.mjs` (human outline fidelity), `scripts/check-ledger.mjs` (closure), `scripts/check-exercises.mjs` (deck shape + composition), `scripts/save-lesson.mjs` (outline + ledger metadata validation, deck validation, PDF + upsert). Never hand-write DB rows.
- **Gates match risk**: gate-1 reviews a changed ledger, gate-2 deeply reviews lesson text, and gate-3 is a fast deterministic deck gate. Browser, PDF, and quiz checks run once after all requested lessons have been saved, never once per author or gate.

## Fast Default For Existing Ledgers

When the requested lessons use an already checked ledger:

1. Run outline and ledger validation once.
2. Author all requested HTML pages in parallel.
3. Run one independent, batched gate-2 review; each lesson still needs its own pass.
4. Create each passed lesson's deck in parallel, then run `check-exercises.mjs`.
5. Save all HTML pages, then all decks.
6. Use one browser session to verify every saved lesson's title, practice section, PDF, and a representative answer flow.

Close completed subagents before starting the next phase. Do not use full-history context for narrowly scoped author or reviewer tasks.

## Capabilities

Capability numbers are stable user-facing shortcuts. Do not renumber.

1. `capability-1-stage-ledger`: author or revise ONE stage's outline as a concept ledger (`resources/content/math-ledger/stage-<n>.json`). → `references/capability-1-stage-ledger/ledger.md`, gate `references/gate-1-ledger/gate.md`, script `scripts/check-ledger.mjs`.
2. `capability-2-lesson-html`: author ONE lesson's 課文 HTML from its ledger entry, using the genre-specific section structure. → `references/capability-2-lesson-html/lesson.md`, gate `references/gate-2-lesson/gate.md`, template `assets/lesson-template.html`.
3. `capability-3-exercises`: author ONE lesson's exercise deck JSON (layers, modes, review tail) from the ledger + gate-2-passed 課文. → `references/capability-3-exercises/exercises.md`, fast gate `references/gate-3-exercises/gate.md`, script `scripts/check-exercises.mjs`.
4. `capability-4-persist`: deterministically persist 課文 (+print PDF) and deck into `sr_lessons` / `sr_questions`. → `references/capability-4-persist/persist.md`, script `scripts/save-lesson.mjs`.

## Hard rules

- The human course guide is the source for lesson titles/order/direction; the ledger is the downstream machine SSOT for lesson order, terms, and review scheduling. cap2/cap3 read the checked ledger; they never invent terms outside it (new needed terms go back into the ledger first).
- `scripts/check-outline.mjs resources/content/course-gen-guide-math.md --ledger <stage-ledger>` and `scripts/check-ledger.mjs <stage-ledger>` must pass before any cap2/cap3 authoring against that ledger.
- A lesson persists only after gate-2 passes for its 課文 and gate-3's deterministic deck check passes.
- ids: `math-s<stage>-<order2>` (e.g. `math-s2-03`). Paths repo-relative; run from repo root.
- New lessons default `status='draft'` until promoted.
- Chinese throughout; formal terms landed with `<span class="sr-term">` on first introduction; KaTeX for all math.
- cap4 always receives `--ledger resources/content/math-ledger/stage-<n>.json`. It automatically checks the human course guide (or an explicit `--outline`) and rejects a lesson/deck whose id or metadata is not in that checked outline/ledger; deck saves run `check-exercises.mjs` before any DB mutation.
- A successfully persisted lesson automatically activates the matching deterministic outline id in the app catalog and navigation. Do not hand-edit availability ids in `app/src/lib/curriculum.ts`.
- Do not spend browser time before persistence on normal course generation. The final cap4 browser pass owns rendered KaTeX, responsive layout, practice visibility, PDF, and answer-flow observation.
