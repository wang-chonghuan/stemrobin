# Story Contract (shared)

Single source of truth for what an `sr-story` 名人传记 chapter is and how it is encoded. Every capability and gate reads this. Language: Chinese narrative; English primary-source excerpts.

## First cause

A chapter exists to make a **12–16-year-old** reader *want to keep reading* about a real creator — how a real person turned 科学/发明 into 事业 — by telling it **like a story**: a linear, factual, absorbing narrative. It is NOT a lesson, NOT a summary with headings and bullet lists, NOT a sermon, NOT hero-worship. Hook the reader in the first paragraph, then carry them through the real events in order. Land the facts; let the reader draw the lessons. Save the moral/思辨 material for the questions, not the prose.

## Output format — Markdown (not HTML)

The authored, gated, and stored artifact is **Markdown**. Unlike `sr-lesson` (which authors self-contained HTML), a biography chapter is prose, so HTML is only produced at render time (the app converts the stored md → html). Author a `.md` file; never author the chapter as HTML.

The markdown of one chapter:
- **One `#` H1**: the chapter title (evocative but honest, Chinese).
- Then **flowing narrative paragraphs** — ordinary Markdown paragraphs separated by blank lines. This is the body: a continuous story.
- Exactly **one embedded quote from the person's own words**, as a Markdown blockquote (`> …`), **in Chinese** (a faithful translation of a real public-domain passage — 2–6 sentences), immediately followed by a one-sentence Chinese source note line (`> —— 亨利·福特《我的生活与工作》第二章`). The quote must be **Chinese, not English** (English breaks the reading for a Chinese teen). Optionally one short Chinese sentence after it on why it matters. This is the reader's contact with the person's real voice, translated.
- `**bold**` sparingly for a first key term or a pivotal fact. `*italic*` rarely.

## Style rules (hard — this is what the gate enforces)

- **Narrative, not exposition.** Tell the story in time order, as events. A curious 12–16-year-old should be pulled forward. Open with a concrete scene or a sharp fact, not "本章我们将学习…".
- **Continuous large paragraphs. NO bullet/numbered lists in the body** (no `-`, `*`, `1.` list blocks). The only allowed non-paragraph block is the single excerpt blockquote. If you feel the urge to make a list, write it as prose.
- **No internal section headings** beyond the single H1 title. No 为什么读 / 讲述 / 从创造到事业 sub-headers. One title, then the story.
- **Minimal 说教 (moralizing).** State facts and let them speak. A brief honest touch of ethical complexity is allowed *woven into the narrative* (a sentence, in passing), but do not lecture, do not editorialize, do not "抒发感想". The reflective/moral thinking belongs in the **questions** (see capability 4).
- **Linear factual voice.** Prefer "他做了 X，结果是 Y" over "这告诉我们…". Concrete numbers, dates, places, decisions.
- **Length: the 正文 (Chinese narrative, excluding the English excerpt) MUST be ≥ 2000 Chinese characters** (~10+ minutes of reading). This is enforced deterministically by `scripts/wordcount.mjs`. If a chapter is short, do NOT pad with fluff or moralizing — go back into the book's markdown and mine more real detail (specific scenes, numbers, people, causes) to deepen the story.

## Public-domain rule (hard)

- Source books MUST be out of US copyright — Project Gutenberg, or Internet Archive scans of works published before 1929 (or author long deceased). Record the exact source URL in `sr_stories.source_url`.
- The quote must be a **faithful Chinese translation of a real, locatable passage** in that public-domain text — do NOT invent words the person never wrote, and do not translate from a copyrighted modern biography. The author must be able to point to the exact English source lines the translation renders (for the gate to verify faithfulness). A quote that has no real source passage, or that distorts its meaning, is a hard failure. If unsure whether a source is public domain, stop and ask.

## Question model (capability 4 → `sr_story_questions`)

8–14 items per chapter, each: `{ ord, type, prompt, answer_mode: 'choice'|'work', options (choice only), correct_index (choice only), answer (hidden reference answer) }`.

- `type` spans **理解 / 推断 / 创业推理 / 品格 / 辨错** (comprehend the text; infer beyond it; reason about the business decision "换你会怎么做"; weigh character/ethics; spot a wrong reading).
- MOST items are `answer_mode:'choice'` (3–4 options, exactly one correct, distractors = plausible misreadings of THIS chapter) — these test the **details** of the story.
- Because the narrative itself no longer moralizes, the **口试 must also ask the 说教/思辨 questions**: include at least 2 `work` (open) items of type 品格/推断 that make the reader weigh the ethics or judgment the story deliberately left un-preached ("福特这么做，对工人公平吗？写下你的理由").
- `answer` is a hidden reference answer for every item; never pre-revealed. Only the post-answer quiz reveal shows it.

## Ids & DB (persistence contract)

- story id: `<slug>` (lowercase, e.g. `ford`, `carnegie`). chapter id: `<story>-c<order2>` (e.g. `ford-c01`).
- Persistence is ONLY via `scripts/save-story.mjs` (never hand-write rows). It targets the Azure easy-app Postgres, schema `stemrobin-schema`, using the server-only connection string from repo-root `.env` (`EASYAPP_DATABASE_URL`, or `DATABASE_URL` in the Container App).

Tables — `sr_stories`, `sr_story_chapters`, `sr_story_questions`, `sr_story_answer_events` — are defined in `ssot-schemas/db-schemas/stemrobin.sql` (the SSOT). Key point for this format:

- `sr_story_chapters(id, story_id, ord, title, **md**, status)` — the chapter body is stored as **Markdown** in the `md` column. The app renders md → html at display time.
- `sr_story_questions(id, chapter_id, ord, type, prompt, answer_mode, options, correct_index, answer)`.

Do not redefine these here — read the SSOT for exact columns. New chapters/stories default `status='draft'`.
