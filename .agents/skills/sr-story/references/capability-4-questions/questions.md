# Capability 4 — Chapter → questions (details + 口试 reflection)

From a chapter's narrative Markdown, author the **structured questions** the card-quiz renders. Read `references/common/story-contract.md` (Question model) first. Because the narrative deliberately does NOT moralize, the questions carry both the **factual detail** and the **说教/思辨 (口试)** material.

**Execution:** an **independent subagent** reads the chapter `.md` and authors the questions. Persistence is cap5.

## What to produce

A JSON array of **8–14 items** to a scratch path (`<scratch>/<story>-c<order2>.questions.json`). Each item:

```json
{ "ord": 1, "type": "理解|推断|创业推理|品格|辨错", "prompt": "题干",
  "answer_mode": "choice", "options": ["A","B","C","D"], "correct_index": 0, "answer": "隐藏参考答案" }
```

Rules:
- **Most items are `answer_mode:"choice"`** (3–4 short options, exactly one `correct_index`) testing the **details of the story** — what happened, who, when, why, the numbers. Distractors are plausible misreadings of THIS chapter, not random.
- **The 口试 also asks the reflection.** Include **at least 2** `answer_mode:"work"` open items (options/correct_index = null) of type **品格** or **推断/创业推理** that make the reader weigh the ethics or judgment the narrative left un-preached — e.g. "福特把工资提到一天五美元，同时派人检查工人的家，这是慷慨还是控制？写下你的看法和理由。" This is where the moral thinking lives now.
- Coverage should span the five types (理解/推断/创业推理/品格/辨错). At least one 理解 item should test a specific concrete detail of the chapter (a number, decision, or cause).
- Every item carries a hidden `answer` (reference answer, or, for open items, what a strong answer would weigh); never pre-revealed.
- Ground every question in the chapter's actual content. Output strict valid JSON (no trailing commas/comments, exactly one correct option per choice item).

Report: output path, item count, choice-vs-work split (must have ≥2 work), type coverage, and confirm `JSON.parse` succeeds. Do not touch the DB (cap5).
