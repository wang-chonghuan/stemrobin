---
name: sr-math-lesson
description: Load when the user asks to build StemRobin math lessons — generate a stage's concept ledger (概念台账) into the DB, author one lesson's card-tree content JSONB + read-check, author its exercise deck JSONB, or persist a lesson to the DB and render its HTML/PDF — or says "sr-math-lesson cap1/2/3/4", "生成数学大纲", "生成数学课", "重新生成某一课". Replaces sr-lesson for math. JSONB-first: the DB JSONB (ledger + card-tree content + exercise deck + zh prose overlay) is the single content authority; HTML/PDF are rendered from it. Model-first pedagogy: concept ledger, prerequisite closure, recall-first exercises, baked-in spaced review.
---

# sr-math-lesson

Build StemRobin math lessons for a young, high-comprehension learner (~8yo doing 12+ content). This skill exists because the previous generation failed in a specific, diagnosed way: procedures were teachable but the **conceptual vocabulary was never a teaching target**, prerequisites silently broke (lessons used terms no lesson ever taught), and exercises drilled only the current lesson's procedure via recognition. The learner could compute but could not name or parse what he was computing on.

The fix is structural, not stylistic. Read `references/common/lesson-contract.md` before any capability — it is the SSOT for the pedagogy, the ledger, the lesson genres, the exercise deck model, and the DB shape.

## JSONB-first (the content SSOT is the DB, not files)

The DB JSONB is the single authority for content (`ssot-schemas/db-schemas/stemrobin.sql`, the "JSONB CONTENT SSOT" block). Three neutral JSONB families are authored and persisted; HTML/PDF are DERIVED and rendered from them:

1. **ledger** → `sr_content_ledger (subject, stage, ledger, src_rev)` (read from the DB by cap2/cap3, never from a local `resources/content/math-ledger/*.json` file).
2. **content** (card-tree) → `sr_lessons.content = { cards: [ { id, num, anchor, rev, body[], read_check[] } ] }`. Each substantial card carries its own read-check (读没读题).
3. **exercises** (deck) → `sr_lessons.exercises = { items: [ { id, ord, type, mode, layer, review_of, key, rev } ] }`.

Learner-visible **prose** (card bodies, read-check + exercise prompts/options) lives in the source-locale overlay `sr_lesson_i18n (lesson_id, locale='zh', overlay)` keyed by node_id; formulas (KaTeX), SVG, numeric literals, and the answer **KEY** (`correct_index`/`accept`/`answer`) stay in the neutral base. The KEY is neutral-base-only and never enters the overlay or any rendered learner-visible HTML (answer-key secrecy). `sr_lessons.html`/`pdf` are regenerable caches rendered by `scripts/render-lesson.mjs`.

## Design commitments (why this skill is shaped this way)

1. **Human outline, then ledger, then lessons.** Start from `resources/content/course-gen-guide-math.md` and preserve its stage, lesson order, title, and instructional direction unless a human explicitly changes the outline. A stage's machine-readable 概念台账 then expands that outline: every lesson declares what terms it `introduces` and `consumes`. A script enforces **prerequisite closure** — no lesson may use a term no earlier lesson taught. This is what mechanically prevents the 去括号-uses-因子-nobody-taught failure.
2. **Model first.** Every stage has ONE central mental model (e.g. 代数式 stage: *式子是一棵两层的树*). Concepts are names for parts of the model; procedures are moves on the model. Lessons teach the model, then the moves.
3. **Concepts get their own lessons.** 概念课 is a first-class genre whose goal is naming/parsing fluency, with instances, non-instances, and boundary cases — not a definition paragraph inside a procedure lesson.
4. **Choice-only practice — exactly 4 options (A/B/C/D), single answer.** Every exercise is a single-answer choice question with **exactly four options**: one correct, three distractors. Each distractor must be the **same kind and surface form as the correct answer** (a number question's distractors are other numbers; an expression question's are other expressions) and be wrong for a **nameable, common misconception**. Never mix a concrete answer with meta-sentence "误区标签" options, never use filler like "无法确定 / 以上都不对", and never leave the correct option as the only one of its form — that makes the answer guessable at a glance. If you cannot name why a child would pick a distractor, it is not good enough.
5. **Review is baked in.** Every deck carries 复习 items targeting terms from earlier lessons (per the ledger), so spaced repetition happens without any runtime scheduler.
6. **Boundary cases are mandatory.** A pattern-matching child only forms real categories when forced through edge instances (−x 的系数、常数项、单独一个字母是不是单项式).

## Who does what

- **Lesson content is the semantic center.** cap2 uses independent authors and a producer-distinct reviewer. For a group of lessons, author one lesson's card-tree `content` JSONB + `zh` overlay (with per-substantial-card read-check) per author in parallel, then give the whole group to one independent reviewer; it returns a separate pass/fail verdict per lesson. Revisions go back to the owning author and only revised lessons are re-reviewed.
- **Decks are fast, deterministic work.** After a lesson passes gate-2, its author may create the cap3 deck. `check-exercises.mjs` and the saver are the blocking deck checks; do not dispatch a separate semantic deck reviewer unless the user explicitly asks for a deck audit or a previous deck caused an answer-quality incident.
- **Scripts do the deterministic work**: `scripts/check-outline.mjs` (human outline fidelity), `scripts/ledger-core.mjs` (shared closure SSOT), `scripts/check-ledger.mjs` (closure CLI), `scripts/save-ledger.mjs` (validate + upsert ledger into `sr_content_ledger`), `scripts/check-content.mjs` (card-tree shape + num + read-check + KEY-free overlay), `scripts/check-exercises.mjs` (deck JSONB shape + composition), `scripts/render-lesson.mjs` (render HTML/PDF FROM the JSONB), `scripts/save-lesson.mjs` (read ledger from DB, validate content/exercises/overlay, render, upsert `sr_lessons.content/exercises/html/pdf` + `sr_lesson_i18n(zh)`). Never hand-write DB rows.
- **Gates match risk**: gate-1 reviews a changed ledger, gate-2 deeply reviews lesson text, and gate-3 is a fast deterministic deck gate. Browser, PDF, and quiz checks run once after all requested lessons have been saved, never once per author or gate.

## Fast Default For Existing Ledgers

When the requested lessons use an already checked ledger:

1. Run outline + ledger validation once and ensure the ledger is in `sr_content_ledger` (`save-ledger.mjs`).
2. Author each lesson's card-tree `content` JSONB + `zh` overlay (with per-substantial-card read-check) in parallel.
3. Run one independent, batched gate-2 review; each lesson still needs its own pass.
4. Author each passed lesson's exercise deck JSONB + overlay in parallel, then run `check-content.mjs` + `check-exercises.mjs`.
5. Save all lessons (`save-lesson.mjs` renders HTML/PDF FROM the JSONB and upserts content/exercises/overlay/html/pdf per lesson).
6. Verify every saved lesson's rendered title, read-check + practice sections, PDF, and a representative answer flow.

Close completed subagents before starting the next phase. Do not use full-history context for narrowly scoped author or reviewer tasks.

## Capabilities

Capability numbers are stable user-facing shortcuts. Do not renumber.

1. `capability-1-stage-ledger`: author or revise ONE stage's concept ledger and persist it into `sr_content_ledger` (the DB is the ledger SSOT). Author the ledger document, validate closure (`scripts/check-ledger.mjs`), then `scripts/save-ledger.mjs --ledger <scratch.json>`. → `references/capability-1-stage-ledger/ledger.md`, gate `references/gate-1-ledger/gate.md`.
2. `capability-2-lesson-html`: author ONE lesson's card-tree **content** JSONB (`{cards:[…]}`) + its `zh` prose overlay from the ledger entry (read from the DB), using the genre section anchors; author each substantial card's `read_check[]`. Validate with `scripts/check-content.mjs`. → `references/capability-2-lesson-html/lesson.md`, gate `references/gate-2-lesson/gate.md`, render target `assets/lesson-template.html`.
3. `capability-3-exercises`: author ONE lesson's exercise **deck** JSONB (`{items:[…]}` — layers, modes, review tail) from the ledger + gate-2-passed content, plus its `zh` overlay prose. Validate with `scripts/check-exercises.mjs`. → `references/capability-3-exercises/exercises.md`, fast gate `references/gate-3-exercises/gate.md`.
4. `capability-4-persist`: deterministically persist `content` + `exercises` JSONB + `zh` overlay and render the derived HTML (+print PDF) FROM the JSONB into `sr_lessons` (content/exercises/html/pdf) + `sr_lesson_i18n(zh)`. → `references/capability-4-persist/persist.md`, scripts `scripts/save-lesson.mjs` + `scripts/render-lesson.mjs`.

## Hard rules

- The human course guide is the source for lesson titles/order/direction; the ledger (in `sr_content_ledger`) is the downstream machine SSOT for lesson order, terms, and review scheduling. cap2/cap3 read the checked ledger from the DB; they never invent terms outside it (new needed terms go back into the ledger first).
- Author/revise a stage ledger, run `scripts/check-ledger.mjs <scratch-ledger.json>` (closure) + `scripts/check-outline.mjs resources/content/course-gen-guide-math.md --ledger <scratch-ledger.json>` (human-outline fidelity), then `scripts/save-ledger.mjs --ledger <scratch-ledger.json>` to make the DB the ledger SSOT before any cap2/cap3 authoring against that stage.
- A lesson persists only after gate-2 passes for its content and gate-3's deterministic deck check passes.
- ids: `math-s<stage>-<order2>` (e.g. `math-s2-03`). Paths repo-relative; run from repo root.
- New lessons default `status='draft'` until promoted.
- Chinese throughout; formal terms landed with `<span class="sr-term">` on first introduction; KaTeX for all math.
- cap4 (`save-lesson.mjs`) reads the ledger from `sr_content_ledger` (subject+stage parsed from `--id`), runs `check-content.mjs` + `check-exercises.mjs` before any DB mutation, and for real stages runs the human-outline fidelity check (a disposable `--sample` skips only that outline check). It rejects content/exercises whose id or metadata disagrees with the DB ledger.
- A successfully persisted lesson automatically activates the matching deterministic outline id in the app catalog and navigation. Do not hand-edit availability ids in `app/src/lib/curriculum.ts`.
- The answer KEY (`correct_index`/`accept`/`answer`) is neutral-base-only: it never enters the `zh` overlay or any rendered learner-visible HTML. `check-content.mjs` enforces a KEY-free overlay; the renderer never emits `key`.
- Do not spend browser time before persistence on normal course generation. The final cap4 render owns HTML/PDF; verify rendered KaTeX, responsive layout, practice visibility, PDF, and answer-flow separately after save.
