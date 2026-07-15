# Math Lesson Contract (shared SSOT)

Every capability and gate reads this. It encodes what we learned from the failure of the previous generation: the learner (a bright ~8-year-old handling 12+ content) could execute procedures yet could not answer conceptual questions, because vocabulary was never a target, prerequisites silently broke, and practice was recognition-only.

## First cause

A lesson exists so the learner ends up with a **working mental model plus the language to talk about it** — not just the ability to reproduce a procedure. Success criterion per lesson: the learner can (a) point at any instance and *name its parts fast*, (b) *do* the move, (c) *say why* the move is legal, and (d) still do (a)–(c) two weeks later. The deck design (recall, boundary cases, review tail) exists to make (a) and (d) true; the 課文 design exists to make (b) and (c) true.

## JSONB-first (content SSOT = the DB)

This skill is **JSONB-first**: the DB JSONB is the single content authority (`ssot-schemas/db-schemas/stemrobin.sql`, the "JSONB CONTENT SSOT" block). Ledger → `sr_content_ledger`; card-tree content → `sr_lessons.content`; exercise deck → `sr_lessons.exercises`; learner-visible prose → the source-locale overlay `sr_lesson_i18n(locale='zh')`; `sr_lessons.html`/`pdf` are DERIVED caches rendered from the JSONB. The answer KEY (`correct_index`/`accept`/`answer`) is neutral-base-only and never enters the overlay or any rendered learner-visible HTML. The exact JSONB shapes are documented in `ssot-schemas/db-schemas/stemrobin.sql`; this contract file and the deterministic validators enforce them.

## The ledger (概念台账)

`resources/content/course-gen-guide-math.md` is the human outline source for the stage's lesson titles, order, and instructional direction. The downstream machine-readable stage outline and SSOT for lesson metadata, terms, and review scheduling is the **ledger document persisted in `sr_content_ledger` (subject, stage, ledger, src_rev)** — read from the DB by cap2/cap3, never from a local `resources/content/math-ledger/*.json` file. (Author a ledger as a scratch JSON, validate with `check-ledger.mjs`, then `save-ledger.mjs` upserts it into the DB.)

```json
{
  "subject": "math",
  "stage": 2,
  "theme": "代数式",
  "model": "One sentence stating the stage's central mental model.",
  "assumed": [
    { "concept": "有理数加减乘除", "from": "stage-1" },
    { "concept": "乘方与指数记号", "from": "GAP", "note": "explain the gap" }
  ],
  "lessons": [
    {
      "id": "math-s2-03",
      "order": 3,
      "title": "式子的两层：项与因数",
      "genre": "概念课",
      "status": "planned | generated | published",
      "core_idea": "One sentence — the ONE idea this lesson installs.",
      "introduces": [ { "term": "项", "kind": "概念" }, { "term": "去括号", "kind": "方法" } ],
      "consumes": ["代数式"],
      "boundary_cases": ["−x 的系数是 −1", "常数项"]
    }
  ]
}
```

Rules:
- **Outline fidelity**: cap1 starts from the matching stage in `resources/content/course-gen-guide-math.md`. Preserve lesson title/order/direction in the ledger unless a human explicitly changes the human outline first. The ledger may add prerequisite anatomy detail, but it may not silently replace or reorder an outline lesson. `scripts/check-outline.mjs` mechanically verifies that every guide lesson remains exactly once and in order.
- **Prerequisite closure (mechanical, `scripts/check-ledger.mjs`)**: every term in a lesson's `consumes` must appear in an earlier lesson's `introduces` or in `assumed`. No exceptions. If a real gap exists (e.g. the previous stage never taught 乘方), record it in `assumed` with `"from": "GAP"` and a note — visible debt, never silent.
- Terms are unique across `introduces` (one lesson owns each term).
- `genre` ∈ 概念课 | 方法课 | 练习课. A stage should give heavy-vocabulary clusters their own 概念课 rather than smuggling definitions into 方法课.
- `boundary_cases` listed here are commitments: cap2 must teach them, cap3 must test them.
- The ledger is allowed to disagree with mainstream textbook lesson-slicing. Slice by *one installable idea per lesson*, merge lessons that are one move (e.g. 同类项 + 合并), and add anatomy lessons textbooks skip.

## Lesson genres (課文 structure)

Self-contained HTML from `assets/lesson-template.html` (head/style shell + header). Sections carry `data-sr-section` anchors; the saver validates the set per genre. Numbered section labels use the template's `sr-sec-num/sr-sec-name` classes.

**概念课** (goal: the learner can parse instances and name parts) — anchors, in order: `motivation, model, anatomy, boundary, connections, oral`
1. `motivation` 为什么需要这个名字 — a real confusion that having the name resolves. Never "本课我们学习…".
2. `model` 建立概念 — the definition **through the stage model**, with a `.sr-eg` block of 正例/反例, and a hand-drawn inline SVG diagram of the structure (e.g. the two-layer expression tree). First formal term in `<span class="sr-term">`.
3. `anatomy` 拆给你看 — 2–4 worked *parsing* examples (`.sr-example`): take a concrete expression, decompose it aloud, name every part.
4. `boundary` 边界与陷阱 — every ledger `boundary_cases` entry gets treated honestly (`.sr-pitfall` for traps). This is where categories become real.
5. `connections` 与其他知识点的联系 — backward (what this stands on) and forward (what will consume this term next), by name.
6. `oral` 概念口试 — 4–6 point-and-name questions (`ol.sr-oral`), answers in hidden `<div class="sr-answer">`.

**方法课** (goal: the learner can do the move and say why it's legal) — anchors, in order: `motivation, explain, examples, connections, oral`
1. `motivation` 为什么学这个 — the driving problem the move solves.
2. `explain` 讲解 — the move **derived from the principle** (e.g. 去括号 from 分配律 on the tree), cases if needed, `.sr-pitfall` for the classic mistakes.
3. `examples` 例题 — 3–5 `.sr-example` worked examples with `.sr-step` steps; include one 说理 example (explain-why, not compute).
4. `connections` — backward/forward as above.
5. `oral` — 4–6 conceptual questions, hidden answers.

**练习课** (goal: mixed retrieval across the whole stage) — anchors: `motivation` only. The 課文 is a short orientation (what this arena covers, how to use the card-quiz, the self-check habit) — 3–5 paragraphs, no new content. The substance is the deck: a full-size mixed deck whose items may target ANY earlier lesson's terms/moves (it introduces nothing). Same composition rules apply; 复习-layer items still carry `review_of`.

**Header format (all genres, uniform):**
- `{{TITLE}}` = **`<stage>.<order> 标题`**, e.g. `2.6 去括号` — the number lives IN the lesson title (the app's top bar shows no title; the sidebar shows the same `2.6` numbering).
- `{{EYEBROW}}` = `数学 · <stage theme> · <genre>`, e.g. `数学 · 代数式 · 方法课`. No `第 N 课` / `阶段 N` noise — the title's number already says it.

Both genres:
- **Vocabulary contract**: every technical term used must be either introduced in THIS lesson or present in an earlier lesson's `introduces`/`assumed`. On first use of a consumed term, a one-line reminder is welcome ("还记得吗：项是按加减切出来的块"). `check-ledger.mjs --vocab` greps the HTML for later-lesson terms; the gate hunts wild jargon.
- 深入浅出, school-serious tone (resources/reference/DESIGN.md), no encouragement filler, no cartoon metaphors that will have to be unlearned. The tree/layer language IS the metaphor and it is the real structure.
- **Authors never write a `practice` section** — the deck is the SSOT. The saver (cap4 deck path) GENERATES a `practice` section from the deck and embeds it into the stored 課文: prompts + choice options only (the answer key — `answer`/`correct_index`/`accept` — never enters the html; checking happens in the card-quiz). On screen the learner sees every question while reading; in the printed PDF the practice starts on its own page with full-width rules between items (pen-writing room). A hand-authored practice section fails gate-2.
- KaTeX `$...$`/`$$...$$`; inline SVG for figures (viewBox, labeled, template palette); never images.

## Exercise deck (cap3 → `sr_questions`)

A deck is a JSON array of 16–24 items. Item shape:

```json
{
  "ord": 1,
  "layer": "指认 | 操作 | 辨错 | 说理 | 复习",
  "review_of": null,
  "type": "辨认 | 表示 | 操作 | 反推 | 辨错 | 说理",
  "prompt": "题干（KaTeX ok）",
  "answer_mode": "choice",
  "accept": null,
  "options": ["选项 A", "选项 B", "选项 C"],
  "correct_index": 0,
  "answer": "参考答案/解释（作答后展示）"
}
```

- `layer` is the deck-composition role; `type` is the cognitive act shown to the learner as a tag. A 复习-layer item still carries a normal `type`.
- `review_of` — only for `layer:"复习"`: the earlier-lesson term this item refreshes (must exist in the ledger's earlier `introduces` or `assumed`).

**Answer mode**
- `choice` only: at least 3 options, exactly one `correct_index`, and no upper limit on option count. Distractors are real misconceptions of THIS lesson (each distractor should be wrong for a nameable reason). Include more than four options whenever the misconception set genuinely warrants it.

**Composition rules (enforced by `scripts/check-exercises.mjs`)**
- 16–24 items; `ord` unique and contiguous from 1.
- 指认 layer ≥ 25% — fast naming/parsing of this lesson's (and reviewed) terms.
- 操作 layer ≥ 20%.
- 辨错 ≥ 2 items; 说理 ≥ 2 items. 说理题也用选择项检验理由辨析。
- 复习 ≥ 3 items unless this is the stage's first lesson — targets scheduled by the **review tail rule**: prefer terms introduced 1 lesson ago (×2), 2 lessons ago (×1–2), 3 lessons ago (×1). Deeper review is welcome.
- **Boundary mandate**: each ledger `boundary_cases` entry for this lesson appears in ≥1 item (gate-checked semantically).
- Every item has a substantive `answer` that *teaches* (why, not just the value).

## Ids & DB (JSONB-first persistence contract)

- Lesson id `math-s<stage>-<order2>`; persistence ONLY via `scripts/save-lesson.mjs --id <id> --content <c.json> --exercises <e.json> --overlay <o.json>` (reads the ledger from `sr_content_ledger`, validates content+overlay via `check-content.mjs` and exercises+overlay via `check-exercises.mjs`, for real stages validates human-outline fidelity, renders HTML + print PDF FROM the JSONB via `render-lesson.mjs`, upserts). The ledger is persisted separately via `scripts/save-ledger.mjs`.
- Tables (SSOT `ssot-schemas/db-schemas/stemrobin.sql`):
  - `sr_content_ledger(subject, stage, ledger JSONB, src_rev)` — the concept ledger.
  - `sr_lessons(id, subject, stage, lesson_order, title, concept, html, pdf, content JSONB, exercises JSONB, status)` — `content = {cards:[{id, num, anchor, rev, body[], read_check[]}]}` and `exercises = {items:[{id, ord, type, mode∈choice|input|work, layer, review_of, key, rev}]}` are the SSOT; `html`/`pdf` are derived caches.
  - `sr_lesson_i18n(lesson_id, locale, overlay JSONB)` — per-locale prose overlay `{ node_id → { t, src_rev } }`. `zh` is the source overlay authored here; prose ONLY, never a KEY.
  - `sr_content_answer_events(…)` — learner runtime table (not written by the generator).
- Read-check items (`content.cards[].read_check[]`) use `mode ∈ choice|input`; exercise items use `mode ∈ choice|input|work`. The sample/current math pedagogy stays choice-first; the validators accept the full schema mode set.
- **Answer-key secrecy**: `correct_index`/`accept`/`answer` live only in the neutral-base `key`; they never reach the `zh` overlay or any rendered learner-visible HTML. `check-content.mjs` enforces a KEY-free overlay; the renderer never emits `key`.
- The app sidebar title/order outline (`app/src/lib/curriculum.ts`) must match the human course guide. Its clickable availability is automatically derived from ids present in `sr_lessons`; cap4 does not hand-edit catalog links.
