---
name: sr-story
description: Load when the user asks to build a StemRobin 名人传记 (biography reading, a narrative story stored as Markdown) — convert a public-domain book to markdown, outline it, author a chapter as a story, generate its questions, or persist a chapter+questions to the DB — or says "用 sr-story 生成传记", "sr-story cap1/2/3/4/5", "把福特自传做成章节". Sibling of sr-lesson, for biography/reading content (not math/physics lessons). Public-domain sources only.
---

# sr-story

Build StemRobin 名人传记 — biography reading modules from **public-domain** books (Gutenberg / Internet Archive, works out of US copyright). Unlike `sr-lesson` (self-contained HTML), a biography chapter is **prose stored as Markdown**: a linear, factual, absorbing **story** for a 12–16-year-old (the app renders md → html). Told like a story, not a lesson — hook first, minimal 说教, no bullet lists; the moral/思辨 material lives in the questions. 正文 ≥ 2000 汉字 per chapter.

A **story** = one creator's 传记 (a person/book, e.g. 福特). It has an **outline** (chapters) and, per chapter, a **narrative Markdown body** + **questions**. Subject scope: American inventor-entrepreneurs / industrialists whose story shows 科学/发明 → 事业, treating the ethical complexity (monopoly, humbug, labor, prejudice) honestly but through the questions rather than sermons — critical thinking, not hagiography.

## Who does what — MUST use an independent subagent to author

- **Authoring (cap2 outline, cap3 chapter, cap4 questions) MUST run in an independent subagent.** The orchestrator dispatches a fresh subagent; producer ≠ reviewer so `gate-3` is a genuine review.
- **The orchestrator gates and persists.** After the chapter subagent returns, run `gate-3` (prefer a second subagent), rerun on failure, then run the deterministic saver.
- **Scripts do the deterministic work.** `scripts/book-to-md.mjs` (cap1, markitdown) and `scripts/save-story.mjs` (cap5, shape-validate + upsert). Never hand-write DB rows.

## Capabilities

Capability numbers are stable user-facing shortcuts. Do not renumber.

1. `capability-1-book-to-md`: convert a public-domain book (PDF/EPUB/HTML) to clean markdown with Microsoft **markitdown**. → `references/capability-1-book-to-md/convert.md`, `scripts/book-to-md.mjs`.
2. `capability-2-outline`: from a book's markdown, author a chapter **outline** adapted for a young gifted learner (not the raw TOC). → `references/capability-2-outline/outline.md`.
3. `capability-3-chapter`: from the book markdown + outline, author **one chapter as a narrative Markdown story** (linear factual prose in the author's own words, 12–16-year-old, ≥2000 汉字, no bullet lists, no quotes/blockquotes, minimal 说教). Gated by `references/gate-3-chapter/gate.md`; length checked by `scripts/wordcount.mjs`. → `references/capability-3-chapter/chapter.md`.
4. `capability-4-questions`: from a chapter, author **questions** — mostly choice for story details, plus **≥2 open `work` 口试 items** carrying the 说教/思辨 the narrative deliberately left out. → `references/capability-4-questions/questions.md`.
5. `capability-5-persist`: **persist** a chapter (Markdown → `md` column) + its questions into `stemrobin.sr_stories` / `sr_story_chapters` / `sr_story_questions`. → `references/capability-5-persist/persist.md`, `scripts/save-story.mjs`.

Before any capability, read `references/common/story-contract.md` — the SSOT for the Markdown format, the story-not-lesson style rules, the public-domain rule, the length floor, the question model, ids, and the DB shape.

## Gate rule

cap3 produces a persisted, learner-facing artifact, so it **must pass `gate-3` before persisting**. First cause: *would a 12–16-year-old want to keep reading this as a story and come away knowing the real events — or is it a dull lesson, a bulleted summary, a sermon, or padded to length?* Rerun cap3 on failure (mining more book detail if it was short); run `scripts/save-story.mjs` only after it passes.

## Hard rules

- **Public domain only.** Source books must be out of US copyright (Gutenberg / pre-1929 Internet Archive). Record the source URL. Never base a chapter on a copyrighted modern biography.
- Chinese narration throughout, in the author's own words. **No quotes/excerpts** — paraphrase the source's facts into plain prose; never quote the person (in any language).
- id: story `<slug>` (e.g. `franklin`); chapter `<story>-c<order2>` (e.g. `franklin-c01`). Paths repo-relative; run from repo root (`git rev-parse --show-toplevel`).
- New chapters are `status='draft'` until promoted to `published`.
