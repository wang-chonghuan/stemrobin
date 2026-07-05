# Capability 3 — Author one chapter as a narrative Markdown story

From the book markdown + outline (cap1/cap2), author **one chapter** of the 名人传记 as a **Markdown** file that reads like a story. Read `references/common/story-contract.md` first — it is the SSOT for the format, the style rules, and length.

**Execution model (mandatory):** the orchestrator does NOT author. It dispatches an **independent subagent** (Agent tool) given: the target chapter (story id + ord + focus + arc from the outline), the relevant **slice of the book markdown**, this file, and the contract. The subagent writes the chapter `.md`. Then the orchestrator runs `gate-3` and persists. Producer ≠ reviewer.

## What to write

A single Markdown file (`<scratch>/<story>-c<order2>.md`):

1. **One `#` H1** — the chapter title (evocative, honest, Chinese).
2. **Continuous narrative paragraphs** telling the chapter's events in time order — a real story a 12–16-year-old wants to keep reading. Open with a concrete scene or a sharp fact. Land the real facts, dates, numbers, people, and decisions. Use `**bold**` once or twice for a pivotal term/fact.

That is the whole chapter — a title and the story. **No quotes, no blockquotes, no excerpts** (in any language). If a real statement the person made matters, paraphrase its substance into your own narration ("福特认定，钱应该是干活的结果，而不是干活的前提"), never as a quotation.

## Hard style rules (the gate enforces these)

- **Story, not lesson.** Linear factual narrative. No section headings beyond the H1. No "为什么读这一章 / 讲述" scaffolding.
- **NO bullet/numbered lists and NO blockquotes** anywhere in the body. Continuous prose only.
- **No quotations.** Do not quote the person (or anyone); tell it in your own words.
- **Minimal 说教.** State what happened; don't lecture or "抒发感想". At most a light, in-passing touch of ethical complexity — the real moral/思辨 questions go into cap4, not the prose.
- **Length: 正文 ≥ 2000 汉字.** Check it: `node .agents/skills/sr-story/scripts/wordcount.mjs <scratch>/<story>-cNN.md`. If short, DO NOT pad with filler or feelings — reopen the book markdown slice and mine more real detail (specific scenes, figures, causes, minor characters, what exactly he built and how) until the story is genuinely that long.

## Steps

1. Resolve the chapter (story id, `ord`, `id = <story>-c<order2>`, title, outline `focus`/`arc`); pull the book slice.
2. Write the narrative md — pure prose, no quotes.
3. Run `wordcount.mjs`; if `< 2000`, mine more detail and expand the story (not the moralizing).
4. Self-check: would a 12–16-year-old keep reading? Is it a story, not a lesson? Any bullet lists, blockquotes, quotations, or preaching to remove? Are all facts traceable to the source?
5. Gate: orchestrator runs `references/gate-3-chapter/gate.md` (independent subagent). Rerun on failure. Persist (cap5) only after it passes.

Do not author questions here — that is cap4. One chapter per run.
