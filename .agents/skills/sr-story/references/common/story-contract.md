# Story Contract (shared)

Single source of truth for what an `sr-story` 名人传记 chapter is and how it is encoded. Every capability and gate reads this. Language: Chinese narrative throughout. **No quotes/excerpts** — the story is told entirely in the author's own natural narration.

## First cause

A chapter exists to make a **12–16-year-old** reader *want to keep reading* about a real creator — how a real person turned 科学/发明 into 事业 — by telling it **like a story**: a linear, factual, absorbing narrative. It is NOT a lesson, NOT a summary with headings and bullet lists, NOT a sermon, NOT hero-worship. Hook the reader in the first paragraph, then carry them through the real events in order. Land the facts; let the reader draw the lessons. Save the moral/思辨 material for the questions, not the prose.

## Output format — Markdown (not HTML)

The authored, gated, and stored artifact is **Markdown**. Unlike `sr-lesson` (which authors self-contained HTML), a biography chapter is prose, so HTML is only produced at render time (the app converts the stored md → html). Author a `.md` file; never author the chapter as HTML.

The markdown of one chapter:
- **One `#` H1**: the chapter title (evocative but honest, Chinese).
- Then **numbered 节 (sections)**, each a `## <global-num> <节标题>` H2 heading followed by **flowing narrative paragraphs**. A chapter has a handful of 节 (≈3–6). Each 节 is still continuous prose — the heading just gives the reader a labeled, citable landing point.
- **The 节 numbers are GLOBALLY CONTINUOUS across the whole biography.** They do **not** reset per chapter: chapter N's first 节 = chapter N-1's last 节 + 1. So the reader can cite "§47" and it is unique in the book. The saver (`save-story.mjs`) enforces this continuity against the previously-saved chapters (`section_end`), so **save chapters in order** and number the 节 accordingly.
- **No quotes, no blockquotes, no excerpts.** Do not quote the person's words (in any language) and do not use `>` blockquotes. If a real statement matters, weave its substance into the narration in plain prose ("福特认定，钱应该是干活干出来的结果"), not as a quotation.
- `**bold**` sparingly for a first key term or a pivotal fact. `*italic*` rarely.

Example skeleton (chapter c02, continuing after c01 ended at §4):
```markdown
# 一根链子、两百美元，和一次辞职
## 5 <节标题>
（连贯叙事段落…）
## 6 <节标题>
（连贯叙事段落…）
```

## Style rules (hard — this is what the gate enforces)

- **Narrative, not exposition.** Tell the story in time order, as events. A curious 12–16-year-old should be pulled forward. Open with a concrete scene or a sharp fact, not "本章我们将学习…".
- **Continuous large paragraphs. NO bullet/numbered lists and NO blockquotes** (no `-`, `*`, `1.` list blocks, no `>` quotes). The body is pure prose paragraphs. If you feel the urge to make a list, write it as prose.
- **Section headings are numbered 节 only** (`## <global-num> <节标题>`), not thematic labels like 为什么读 / 讲述. Each 节 title names a beat of the story (a scene, a turn) in a few words; the prose under it stays continuous. Do not add any other heading levels.
- **Minimal 说教 (moralizing).** State facts and let them speak. A brief honest touch of ethical complexity is allowed *woven into the narrative* (a sentence, in passing), but do not lecture, do not editorialize, do not "抒发感想". The reflective/moral thinking belongs in the **questions** (see capability 4).
- **Linear factual voice.** Prefer "他做了 X，结果是 Y" over "这告诉我们…". Concrete numbers, dates, places, decisions.
- **Length: the 正文 (the Chinese narrative) MUST be ≥ 2000 Chinese characters** (~10+ minutes of reading). This is enforced deterministically by `scripts/wordcount.mjs`. If a chapter is short, do NOT pad with fluff or moralizing — go back into the book's markdown and mine more real detail (specific scenes, numbers, people, causes) to deepen the story.

## Public-domain rule (hard)

- The **source book** the story is based on MUST be out of US copyright — Project Gutenberg, or Internet Archive scans of works published before 1929 (or author long deceased). Record the exact source URL in `sr_stories.source_url`. Do not base a chapter on a copyrighted modern biography. If unsure whether a source is public domain, stop and ask.
- Every event, date, number, and name in the narration must be **traceable to that source** — do not invent facts. (The narration paraphrases the source in the author's own words; there are no quotations to verify, only facts.)

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

- `sr_story_chapters(id, story_id, ord, title, **md**, stage, stage_ord, section_start, section_end, pdf, status)` — the chapter body is stored as **Markdown** in `md` (app renders md → html). `stage`/`stage_ord` group chapters into a named **阶段** (pass `--stage`/`--stage-ord` to the saver; chapters of one stage share the label). `section_start`/`section_end` are the chapter's first/last global 节 numbers (computed by the saver from the `## <num>` headings — do not set by hand). `pdf` is a per-chapter print PDF **pre-rendered by the saver** (like `sr_lessons.pdf`), so the reader can download/print a chapter the same way math lessons print.
- `sr_story_questions(id, chapter_id, ord, type, prompt, answer_mode, options, correct_index, answer)`.

Do not redefine these here — read the SSOT for exact columns. New chapters/stories default `status='draft'`.
