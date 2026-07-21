---
name: sr-english-reader
description: Generate and persist 短文学英语 short-text English lessons for the VOA1500 recitation course — constrained set-cover passages for 8–12 year olds, with per-sentence 中文 gloss and pre-rendered Azure TTS narration. Use when authoring or regenerating a VOA1500 课文.
---

# sr-english-reader

Produces one memorizable short passage per lesson for the 短文学英语 pillar: the learner
reads it (per-sentence narration + 中文), then recites it up a five-level cloze ladder.

The course target is **60 lessons covering all 1541 core VOA words**, so every passage is
written under a **coverage budget**, not freely. The hard constraints come from the batch
0012 release-gate ruling and are enforced by `save-lesson.mjs`, which refuses to write a
non-conforming lesson rather than degrade it.

## Hard constraints (enforced, not advisory)

| Constraint | Value |
|---|---|
| Sentences per lesson | 6–9 |
| Words per lesson | ≤ 120 |
| New target words introduced | ~20–25 |
| Vocabulary | every word must resolve to `resources/content/voa1500-wordlist.json` |
| Allowed outside the list | inflections of in-list words, declared proper names, numbers |
| Gloss | every sentence needs a 中文 gloss |
| Audience | 8–12 year olds; concrete life/dialogue themes |

`save-lesson.mjs` fails the save and prints every violation if any of these break. **Do not
widen the gate to make a passage fit — rewrite the passage.**

## The outline is the plan — read it first

`outline.json` is this course's **curriculum SSOT**: all 60 lessons, each with its
life-domain, title, and the practical thing the learner can do afterwards
(`use`). It encodes two human rulings that the passages must obey:

- **每课要有用** — every lesson is a real everyday situation the child can use, not a
  story for its own sake;
- **话题必须分散** — lessons 4–51 walk across daily life (self, home, school, health,
  shopping, getting around, people, time, nature); only 52–60 turn to the
  social/news topics, where VOA1500's ~200–300 news words (vote/law/army/economy)
  are deliberately concentrated instead of being scattered into small stories.

Never invent a lesson topic ad hoc: take it from `outline.json`. When a lesson is
written, flip its `status` to `written`. Each lesson's `words` array (its assigned
target-word bucket) is filled in at allocation time — that array, not your taste, is
what the passage must cover.

## Authoring order (theme first, never word-list-first)

The ruling is explicit: *课文不能按照词表机械拼接*. So:

1. **Take the lesson's theme + `use` from `outline.json`** and build the situation
   around it. Dialogue is as welcome as narrative — for situations like 问路 /
   退货投诉 / 意见不同, a dialogue is the natural and more useful form.
2. **Write the passage naturally** at 6–9 sentences, as a complete little story or scene
   with a beginning and an end. It must be worth memorizing on its own.
3. **Then** pull it toward the uncovered-word set: check `coverage.mjs`, and revise word
   choices to absorb still-uncovered entries **where the sentence stays natural**. Bend
   the wording to the word list; never bend the story into a word list.
4. **Mark the target words** — this lesson's newly introduced VOA words. These are what
   cloze level 1 hides first, so they should be the words worth recalling.
5. **Write the 中文 gloss** per sentence: natural Chinese conveying the meaning, not a
   word-for-word transliteration. It exists to make the English understandable, and is
   available as a hint at every ladder level.

Unit structure: 10 units × 6 lessons. Lessons 1–5 of a unit introduce new words; lesson 6
mainly recycles that unit's vocabulary but is still **a genuine new story**, never a drill
sheet.

Recurrence: a core word should appear in **≥3 different lessons** — introduced once, then
reappearing naturally in later passages. `coverage.mjs` reports words still under 3.

## Spec format

```json
{
  "id": "english-u01-01", "unit": 1, "order": 1,
  "title": "Walking Home",
  "theme": "walking home from school",
  "properNames": ["Anna"],
  "sentences": [
    { "text": "Anna walks home from school every day.",
      "gloss": "安娜每天从学校走回家。",
      "targets": ["walk", "school"] }
  ]
}
```

`targets` are given as words; the saver converts them to word-token indices, which is what
the reading/recitation projections consume.

## Scripts

| File | Purpose |
|---|---|
| `outline.json` | **the 60-lesson curriculum SSOT** — themes, `use`, and each lesson's target-word bucket |
| `scripts/vocab.mjs` | the VOA1500 gate — lemma resolution + out-of-vocabulary detection |
| `scripts/tts.mjs` | one English sentence → mp3 bytes (Azure `gpt-4o-mini-tts`) |
| `scripts/save-lesson.mjs` | validate → narrate → persist (content + zh overlay + audio) |
| `scripts/coverage.mjs` | VOA1500 coverage across all saved lessons; decides 81's acceptance |

Run from the repo root; deps resolve from `.agents/skills/node_modules`
(`cd .agents/skills && npm install` once). DB + TTS config come from the repo-root `.env`.

```
node .agents/skills/sr-english-reader/scripts/save-lesson.mjs --spec <lesson.json>
node .agents/skills/sr-english-reader/scripts/coverage.mjs --json <report.json>
```

## Boundaries

Never hand-write `sr_*` rows — persistence goes only through `save-lesson.mjs`. The
recitation ladder, its masking and its grading live in the app
(`app/src/lib/english.ts`), not here; this skill only produces content. If the coverage
budget turns out to be unreachable inside 60 lessons × 120 words, that is a **stop and
report to the human**, not a constraint to quietly relax.
