---
name: sr-lesson
description: Load when the user asks to generate or author a StemRobin lesson from the math outline — phrases like "用 sr-lesson 生成这节课", "sr-lesson cap1", "生成数学第一阶段第1节", "根据大纲做'数轴上的位置'这一课", "create the lesson for <math topic>". Math only for now. Produces one self-contained lesson HTML (KaTeX + inline SVG, DESIGN.md styling), saved under public/lessons/ and upserted into stemrobin.sr_lessons. Do not load for non-math subjects, app/UI code, or raw DB tasks.
---

# sr-lesson

Generate StemRobin course lessons from the math curriculum outline. Each lesson is one self-contained HTML file — middle-school-standard concept, low entry / full rigor (深入浅出), built on the fixed five-section template, with formulas via KaTeX and figures via hand-authored inline SVG — written to `public/lessons/<id>.html` (loadable by the frontend) and stored in `stemrobin.sr_lessons`.

Default language: **Chinese**. Subject: **math only** this stage.

## Who does what — MUST use an independent subagent to author

- **Authoring MUST run in an independent subagent.** The orchestrating agent does **not** write the lesson itself. It dispatches a fresh subagent (via the Agent tool) to author the whole lesson — the five sections including the 练习 exercises, the inline SVG figures, the KaTeX math, and the assembly of the HTML from the template. This is mandatory, not optional: the producer must be separate from the reviewer so `gate-1` is a genuinely independent review (a producer grading its own work is not a gate). Dispatch one subagent per lesson.
- **The orchestrator gates and persists.** After the subagent returns, the orchestrator runs `gate-1` (itself an independent review — ideally a second subagent), reruns authoring on failure, and only then runs the deterministic saver.
- **The script does the deterministic work**: `scripts/save-lesson.mjs` mechanically validates the file (section anchors, KaTeX wiring, DESIGN token, no leftover placeholders) and upserts the DB row. Never hand-write the DB row.

## Capabilities

- **Capability 1 — generate one math lesson** → `references/capability-1-math-lesson/workflow.md`. Gated by `references/gate-1-math-lesson/gate.md`.

Before reading any capability, read `references/common/lesson-contract.md` — the SSOT for the five-section template, pedagogy, formula/SVG rules, id/path convention, and persistence — and `lesson-design-system-v1.md`, the visual + structural contract (tokens, section layout, callouts, examples, exercises, figures, inline marks/colors) every lesson must follow.

## Gate rule

Cap 1 produces a complex, persisted, frontend-facing artifact, so it **must pass `gate-1` before persisting**. The gate is a first-cause review: *can a learner read this and still miss the concept?* Run it (prefer an independent subagent), rerun the cap on failure, and only run `scripts/save-lesson.mjs` once it passes. Do not weaken the gate to force a pass.

## Conventions

- id: `math-s<stage>-<order2>` (e.g. `math-s1-01`); static path `lessons/<id>.html` under `public/`.
- New lessons are `status='draft'` until explicitly promoted to `published` (the frontend reads published lessons).
- Paths are repo-relative; run commands from the repo root (`git rev-parse --show-toplevel`).
