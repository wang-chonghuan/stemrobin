# Capability 3 — Author one chapter as a narrative Markdown story

From the book markdown + outline (cap1/cap2), author **one chapter** of the 名人传记 as a **Markdown** file that reads like a story. Read `references/common/story-contract.md` first — it is the SSOT for the format, the style rules, the public-domain excerpt rule, and length.

**Execution model (mandatory):** the orchestrator does NOT author. It dispatches an **independent subagent** (Agent tool) given: the target chapter (story id + ord + focus + arc + excerpt_hint from the outline), the relevant **slice of the book markdown**, this file, and the contract. The subagent writes the chapter `.md`. Then the orchestrator runs `gate-3` and persists. Producer ≠ reviewer.

## What to write

A single Markdown file (`<scratch>/<story>-c<order2>.md`):

1. **One `#` H1** — the chapter title (evocative, honest, Chinese).
2. **Continuous narrative paragraphs** telling the chapter's events in time order — a real story a 12–16-year-old wants to keep reading. Open with a concrete scene or a sharp fact. Land the real facts, dates, numbers, people, and decisions. Use `**bold**` once or twice for a pivotal term/fact.
3. **Exactly one quote from the person's own words**, woven in where it lands hardest: a Markdown blockquote of 2–6 sentences **in Chinese** — a *faithful translation* of a real public-domain passage — then a Chinese source-note line, then optionally one short Chinese sentence on why it matters. **No English in the quote.** Example:
   ```markdown
   > 那台机器停下来给我们的马车让路，我一下就跳下车，赶在赶车的父亲弄明白我要做什么之前，就已经和那位工程师聊上了。他很乐意把整件事讲给我听，还挺得意。他让我看，怎样把链条从驱动轮上卸下来，再换上一条皮带去带动别的机械。
   >
   > —— 亨利·福特《我的生活与工作》第一章

   这一眼，点燃了他此后七十年最大的兴趣。
   ```
   (Keep the exact English source lines you translated at hand — the gate will check your Chinese faithfully renders a real passage.)

## Hard style rules (the gate enforces these)

- **Story, not lesson.** Linear factual narrative. No section headings beyond the H1. No "为什么读这一章 / 讲述" scaffolding.
- **NO bullet or numbered lists** anywhere in the body. Continuous prose only. The single excerpt blockquote is the only non-paragraph block.
- **Minimal 说教.** State what happened; don't lecture or "抒发感想". At most a light, in-passing touch of ethical complexity — the real moral/思辨 questions go into cap4, not the prose.
- **Length: 正文 ≥ 2000 汉字.** Check it: `node .agents/skills/sr-story/scripts/wordcount.mjs <scratch>/<story>-cNN.md`. If short, DO NOT pad with filler or feelings — reopen the book markdown slice and mine more real detail (specific scenes, figures, causes, minor characters, what exactly he built and how) until the story is genuinely that long.
- **Chinese quote, faithfully translated.** Find a real passage in the book slice, translate it to natural Chinese faithfully (do not distort or invent), and quote THAT in the blockquote — **no English**. Report the exact English source lines you translated so the gate can verify. A quote with no real source passage, or one that changes the meaning, is a hard gate failure.

## Steps

1. Resolve the chapter (story id, `ord`, `id = <story>-c<order2>`, title, outline `focus`/`arc`/`excerpt_hint`); pull the book slice.
2. Write the narrative md; embed one verbatim excerpt + gloss.
3. Run `wordcount.mjs`; if `< 2000`, mine more detail and expand the story (not the moralizing).
4. Self-check: would a 12–16-year-old keep reading? Is it a story, not a lesson? Any bullet lists or preaching to remove? Is the excerpt verbatim?
5. Gate: orchestrator runs `references/gate-3-chapter/gate.md` (independent subagent). Rerun on failure. Persist (cap5) only after it passes.

Do not author questions here — that is cap4. One chapter per run.
