# Capability 5 — Persist chapter + questions to the DB

Store a gated chapter (Markdown) and its questions into the story tables. Deterministic — only via `scripts/save-story.mjs`; never hand-write rows. Read `references/common/story-contract.md` (Ids & DB).

## Prerequisite

The story tables live in `ssot-schemas/db-schemas/stemrobin.sql` and are applied to the easy-app Postgres `stemrobin-schema`. `sr_story_chapters` stores the chapter body as Markdown in the **`md`** column. If the saver reports a missing table/column (fresh DB), re-apply once: `psql "$EASYAPP_DATABASE_URL" -f ssot-schemas/db-schemas/stemrobin.sql`, then rerun.

## Steps

1. **Upsert the story** (once per creator), then the **chapter** (md), then **replace the chapter's questions** — one command:

   ```bash
   node .agents/skills/sr-story/scripts/save-story.mjs \
     --story ford --title "亨利·福特" --person "亨利·福特（Henry Ford）" \
     --era "1863–1947" --source-url "https://www.gutenberg.org/ebooks/7213" \
     --chapter ford-c01 --ord 1 --chapter-title "少年与机器" --status draft \
     --md <scratch>/ford-c01.md \
     --questions <scratch>/ford-c01.questions.json
   ```

   The saver validates the chapter Markdown (has an H1, **no `>` blockquotes/quotes**, **no bullet/numbered lists**, no HTML tags, no leftover `{{}}`, and **正文 ≥ 2000 汉字** via `wordcount.mjs`); validates the questions shape (choice items have options + one in-range `correct_index`; every item has `answer`; **≥2 open `work` 口试 items**); upserts `sr_stories` + `sr_story_chapters`; and replaces `sr_story_questions`. Only run it after `gate-3` passed.
2. **Report** the story id, chapter id, 汉字 count, question count, and status. Chapters are `draft` until promoted to `published`.

## Rules

- Persist only a gate-3-passed chapter. The saver guards shape + length; the gate guards story quality.
- One chapter per invocation. Re-running for the same chapter overwrites its md and questions (idempotent).
- Never write the DB by any path other than `save-story.mjs`.
