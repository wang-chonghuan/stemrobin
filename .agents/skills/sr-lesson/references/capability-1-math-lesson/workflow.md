# Capability 1 — Generate one math lesson

Input: one section of the math outline (`docs/course-gen-guide-math.md` 课程顺序), identified by stage + order, or by title. Output: one self-contained lesson HTML written to `public/lessons/<id>.html` and upserted into `stemrobin.sr_lessons`, after passing `gate-1`.

Read `references/common/lesson-contract.md` first — it is the SSOT for structure, pedagogy, formulas, SVG, ids, and persistence.

**Execution model (mandatory):** the orchestrator does NOT author the lesson itself. It resolves the section (step 1), then **dispatches an independent subagent** (Agent tool) to do the authoring — steps 2–5, i.e. the whole lesson HTML including the 练习 exercises. The subagent is given the target section, this workflow, the contract, the design system, and the template, and it writes `public/lessons/<id>.html`. After it returns, the orchestrator runs `gate-1` as an independent review (step 6) and persists (step 7). Producer ≠ reviewer — this separation is the point.

## Steps

1. **Resolve the section.** From the user's request, pin down: subject (`math`), stage, order within stage, title, and the one core concept. Cross-check against the outline in `docs/course-gen-guide-math.md`. Derive `id = math-s<stage>-<order2>`. If the section is ambiguous or not in the outline, ask one short question; do not invent a lesson outside the curriculum.

2. **Gather grounding.** Skim the relevant stage in `docs/course-gen-guide-math.md` and the 掌握标准/禁止事项 in `docs/course-gen-guide-common.md`. Decide: the **motivating question** that makes this topic necessary (what limit/gap in the prior lessons it resolves, posed inside the math system); the abstract structure this lesson must install (the invariant/relationship under the surface); the symbols to introduce; the misconception to surface; and which figures need an SVG.

3. **Author the five sections.** Write the inner HTML for `motivation / explain / examples / connections / practice` (练习 is LAST) per the contract. Section 1 poses the lead-in question (why this topic, what it solves, situated in the math system) — not a list of objectives. Math as KaTeX (`$...$`, `$$...$$`); figures as hand-authored inline `<svg>` with labels. Keep one concept, formal terms always landed, 深入浅出.

4. **Assemble the HTML.** Start from `assets/lesson-template.html`. Replace every `{{...}}` placeholder:
   - `{{EYEBROW}}` e.g. `数学 · 第 <stage> 阶段`; `{{TITLE}}`, `{{CONCEPT}}`.
   - `{{CHIPS}}` a few `<span class="sr-chip">` (e.g. concept tag) and optionally a green chip for the prerequisite.
   - `{{MOTIVATION}} {{EXPLAIN}} {{EXAMPLES}} {{CONNECTIONS}} {{PRACTICE}}`.
   Leave no `{{` placeholder behind. Write the result to `public/lessons/<id>.html` (create `public/lessons/` if missing).

5. **Self-check the core question** (the lesson-contract first cause): could a learner read this and still not understand the concept or its abstract structure, because something is vague, wrong, dumbed-down, or missing? Fix obvious gaps before the gate.

6. **Run `gate-1`** (`references/gate-1-math-lesson/gate.md`). Prefer an independent subagent; give it the concept, the target section from the outline, the rendered HTML path, and the contract. If it fails on a repairable issue, rerun steps 3–4 with its findings as constraints. Do not persist until it passes. Stop and ask the user only on an unresolved decision; stop and report if the same blocker survives repeated rework.

7. **Persist.** Only after gate pass, run the deterministic saver — it validates the file mechanically (5 section anchors, KaTeX wiring, DESIGN token, no leftover placeholders), copies nothing (the file is already in place), and upserts the DB row:

   ```bash
   node .agents/skills/sr-lesson/scripts/save-lesson.mjs \
     --id math-s1-01 --subject math --stage 1 --order 1 \
     --title "数轴上的位置" --concept "用数轴把数和位置一一对应起来" \
     --status draft --html public/lessons/math-s1-01.html
   ```

   If the saver's mechanical validation fails, fix the HTML and rerun it (the gate judges meaning; the saver guards shape).

8. **Report** the id, the static path (`/lessons/<id>.html`, loadable by the frontend), the DB status, and a one-line summary of what concept/structure the lesson installs. Note that it is `draft` until promoted to `published`.

## Boundaries

- Math only. One concept per lesson. No application/word problems for now.
- Do not edit the template's section shells, KaTeX wiring, or DESIGN tokens — author only inner content.
- Do not write the DB row by any path other than `scripts/save-lesson.mjs`.
