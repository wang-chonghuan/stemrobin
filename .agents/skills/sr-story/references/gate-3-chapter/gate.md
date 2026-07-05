# Gate 3 — Chapter narrative (Markdown)

Run after cap3 authors a chapter `.md`, before cap5 persists. Prefer an **independent subagent** (producer ≠ reviewer); give it the chapter markdown, the outline entry, the book slice, and `references/common/story-contract.md`.

## First cause

Would a **12–16-year-old** want to keep reading this — as a story — and come away knowing the real events? Or is it a dull lesson, a bulleted summary, a sermon, or padded with feelings? If it fails any of these, fail the gate — even if every fact is correct.

## Checks

Fail when any is true:

- **Not a story / preachy.** It reads like a lesson or an essay of opinions rather than a linear factual narrative; it lectures, moralizes, or "抒发感想" instead of telling what happened. A light in-passing note of ethical complexity is fine; sustained moralizing is not (that belongs in the questions).
- **Wrong format.** Not Markdown; contains HTML tags; has **bullet or numbered lists** in the body; has internal section headings beyond the single `#` H1; missing the H1 title.
- **Any quote / blockquote.** The chapter contains a quotation or a `>` blockquote (in any language). There must be none — the story is told entirely in the author's own narration. Fail if any quotation or `>` block is present.
- **Too short.** 正文 `< 2000` 汉字. Verify: `node .agents/skills/sr-story/scripts/wordcount.mjs <chapter.md>`. Short-and-padded (filler, repetition, moralizing to reach length) also fails — it must be 2000+ of *real story*.
- **Fabrication.** An event, date, number, or name is not traceable to the public-domain source. Spot-check the load-bearing facts against the book slice; invented facts are an automatic fail.
- **Public-domain violation.** The source book isn't clearly public domain, or the chapter is based on a copyrighted modern biography.
- **Boring or thin.** Opens with scaffolding ("本章讲述…") instead of a hook; is a date-dump with no concrete scenes; a capable teen would not be pulled forward.

## Pass

It reads like a real story a teen wants to finish, in linear factual prose (no lists, no blockquotes, no quotations, no sermon), ≥2000 汉字 of genuine detail, every fact traceable to the public-domain source. Then cap5 may persist. Do not weaken the gate to force a pass; rerun cap3 with the findings (and mine more book detail if it was short).
