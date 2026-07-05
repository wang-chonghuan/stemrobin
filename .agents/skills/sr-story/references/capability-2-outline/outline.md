# Capability 2 — Book markdown → chapter outline

From a book's markdown (cap1 output), author a **chapter outline** for the 名人传记 — the narrative arc adapted for a 12–16-year-old reader, told as a story. NOT the book's raw table of contents. Read `references/common/story-contract.md` first.

**Execution:** the orchestrator dispatches an **independent subagent** to author the outline (it reads the book md, this file, and the contract). The book is long — read it in slices (start, key turning points, end) to find the arc; do not require the whole text in one pass.

## What to produce

A structured outline: the story's `id`/`title`/`person`/`era`/`source_url`, then an ordered list of **chapters**, each with:
- `ord`, `title` (Chinese, evocative but honest),
- `focus` — the one idea/decision/turn this chapter installs (the *strategy/principle* under the events, e.g. 卡内基·纵向整合, 富兰克林·习惯复利, 洛克菲勒·标准化与垄断),
- `arc` — the 科学/发明 → 事业 → 品格/伦理 thread this chapter carries (name the ethical complexity where it belongs),
- `source_span` — the chapter/line range in the book md whose real events this chapter narrates (so cap3 knows which slice to read; the chapter paraphrases it in prose, never quotes it).

## Principles

- **6–12 chapters** — enough to tell the real arc, not a chapter-per-book-chapter dump. Adapt for a capable young learner: one clear idea per chapter, ordered so each builds on the last.
- Cover the whole arc: origins → the key inventions/moves → building the enterprise → the reckoning (ethics, legacy). Do not stop at the triumphant middle.
- Every chapter's `focus` must be a *concept a child can carry*, not just "he did X in year Y".
- Ground it in the actual book — every `focus`/`source_span` traceable to real text, no invented events.

## Output

Write the outline as JSON (for cap3/cap5 to consume) to a scratch/authoring path, e.g.
`<scratch>/<story>.outline.json`. Report the story id/title and the chapter list (ord + title + one-line focus). This outline is authoring input; the persisted product is the per-chapter HTML + questions.
