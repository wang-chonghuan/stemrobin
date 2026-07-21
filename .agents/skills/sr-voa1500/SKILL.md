---
name: sr-voa1500
description: Generate and persist 短文学英语 short-text English lessons for the VOA1500 recitation course — constrained set-cover passages for 8–12 year olds, with per-sentence 中文 gloss and pre-rendered Azure TTS narration. Use when authoring or regenerating a VOA1500 课文.
---

# sr-voa1500

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

**`outline.md` is this course's curriculum SSOT** — the human-authored blueprint
(v2) for all 60 lessons, in 10 units. It is **human property: do not edit it, not by
one character.** Propose changes to the human; never rewrite it yourself.

Each lesson card carries four fields, and they bind the passage:

| Field | Meaning |
|---|---|
| 场景 | the real situation the passage happens in |
| 句型 | 2–4 sentence patterns the learner memorizes and can swap words into (`___` is the slot) |
| 新词 | representative target words — **examples, not the full set** |
| 复用 | older words/themes this lesson rolls back in |

Its selection rule is **frequency first**: how often does a child actually meet this
word or scene? Daily micro-scenes (crossing the road, class, meals, falling out with
a friend, screen time, overhearing the news) come early and repeat; rare errands
(bank, post office) are deliberately out. Every passage is built around its 句型 —
the patterns are the point, the words ride along. Roughly a third are dialogues
〔对话〕, because speaking transfers far better from dialogue than from narration.
Each unit closes with a 〔综合〕 lesson that recycles the whole unit. The abstract
VOA news vocabulary lands in unit 10, seen from a child's eye.

Never invent a lesson topic ad hoc: take 场景 and 句型 from `outline.md`. The 新词
listed there are examples only — the authoritative per-lesson word set comes from
the full 1500-word allocation (the blueprint's own next step), not from that line.

## Authoring order (patterns + scene first, never word-list-first)

The ruling is explicit: *课文不能按照词表机械拼接*. So:

1. **Take the lesson's 场景 + 句型 from `outline.md`** and build the passage so those
   patterns land naturally and repeatedly — a lesson is a pattern drill wearing a
   story, not a box of words. Write it as a dialogue when the card says 〔对话〕.
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
| `outline.md` | **the 60-lesson curriculum SSOT** — the human-authored blueprint (v2): 场景 / 句型 / 新词 / 复用 per lesson. Human property, never machine-edited |
| `scripts/vocab.mjs` | the VOA1500 gate — lemma resolution + out-of-vocabulary detection |
| `scripts/tts.mjs` | one English sentence → mp3 bytes (Azure `gpt-4o-mini-tts`) |
| `scripts/save-lesson.mjs` | validate → narrate → persist (content + zh overlay + audio) |
| `scripts/coverage.mjs` | VOA1500 coverage across all saved lessons; decides 81's acceptance |

Run from the repo root; deps resolve from `.agents/skills/node_modules`
(`cd .agents/skills && npm install` once). DB + TTS config come from the repo-root `.env`.

```
node .agents/skills/sr-voa1500/scripts/save-lesson.mjs --spec <lesson.json>
node .agents/skills/sr-voa1500/scripts/coverage.mjs --json <report.json>
```

## Boundaries

Never hand-write `sr_*` rows — persistence goes only through `save-lesson.mjs`. The
recitation ladder, its masking and its grading live in the app
(`app/src/lib/english.ts`), not here; this skill only produces content. If the coverage
budget turns out to be unreachable inside 60 lessons × 120 words, that is a **stop and
report to the human**, not a constraint to quietly relax.
