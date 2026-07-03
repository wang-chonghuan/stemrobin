# Lesson Contract (shared)

The single source of truth for what an `sr-lesson` math lesson is and how it is encoded. Cap workflows and gates both read this. Subject is **math only** for now.

## First cause

A lesson exists to make one mathematical concept genuinely understood — its definition, the abstract structure under it, and how it connects outward — through clear exposition, worked examples, and practice. It is **深入浅出**: a low, intuitive entry that always lands on the standard formal term and reasoning. It is not dumbed-down (concepts are never deleted), not a science story, not rote technique drilling. Audience is a capable young learner; do not assume a fixed age, assume high comprehension and low symbol tolerance — slow the entry, keep the rigor.

The lesson's **visual + structural styling** is governed by `lesson-design-system-v1.md` (skill root) — tokens, section layout, callouts, examples, exercises, figures, inline marks/colors. Author content with those classes; do not invent styling.

Authoritative pedagogy lives in the repo docs; read them, do not restate them:
- `docs/course-gen-guide-common.md` — 掌握标准、禁止事项.
- `docs/course-gen-guide-math.md` — math-specific rules, the stage/lesson outline, exercise categories.
- `DESIGN.md` — visual language (the template already encodes the tokens).

## Fixed five-section template

Every lesson has exactly these five sections, in this order. The HTML template (`assets/lesson-template.html`) hard-codes the section shells with `data-sr-section` anchors; author the inner HTML for each.

1. **为什么学这个 / 引子问题** (`motivation`) — open with a genuine **motivating question** that makes today's topic feel necessary, and hand the learner that question to carry through the whole lesson. Say why we study this, what problem it solves, and — crucially — what we **cannot yet do** without it. Pose the question **inside the surrounding math system**: connect to what was just learned (which now hits a limit, gap, or tension) and frame today's concept as the answer the learner is about to reach. End by stating the one driving question explicitly. Do **not** list dry objectives ("学完你能…"); motivate, don't enumerate. Still one concept — name what today answers, never preload later terms. (This is the *why-before*; section 4 (connections) is the *structure-after* — keep them distinct: here you create the need, there you map the connections.)
2. **讲解** (`explain`) — the teaching core. Enter through one intuitive situation/figure, then **raise it to the formal term and definition** (mark first formal use with `<span class="sr-term">`). **Immediately after each definition, give a few 正例/反例 in a `<div class="sr-eg">` block** (`<span class="yes">…</span>` for a positive example, `<span class="no">…</span>` for a counter-example) — a definition without examples is too dry; these illustrate the definition, they are NOT worked examples, so keep them to 2–4 short items. Make the abstract structure explicit: what stays invariant, what the rule/object really is underneath the example. Introduce each symbol with its reading, meaning, and boundary of use. Surface at least one common misconception in a `.sr-pitfall` callout.
3. **例题** (`examples`) — 3–5 worked examples, each in a `.sr-example` block with numbered `.sr-step` reasoning. First example tests the bare concept; middle adds one small variation; last requires explaining a reason, not just computing. Do not stack multiple unrelated difficulties into one example.
4. **与其他知识点的联系** (`connections`) — in `<ul class="sr-links">`, connect this concept to prerequisites it builds on and to where it leads next, naming the abstract through-line (e.g. 数轴上的"距离"→绝对值→后续的两点间距离). This is the section that builds structure across lessons; make it substantive, not a list of bare titles.
5. **概念口试** (`oral`) — the teaching focus: build the learner's **network of concepts**, not calculation. In `<ol class="sr-oral">`, ask 4–6 short **conceptual** questions about this lesson's definitions/terms/relations — intuitive "什么是…/为什么…" questions (e.g. 什么是常数项、什么是单项式、代入是什么意思、为什么不看系数). No computation. **Every question must be answerable from this lesson's 讲解** — the section opens by telling the learner to answer themselves and, if stuck, go back to 讲解 to find it (active recall + purposeful re-reading; do NOT give a student-facing reveal). Still store a one-sentence reference answer in a **hidden `<div class="sr-answer">…</div>`** — it stays invisible to the student and only surfaces in teacher/answer-key mode (`body.sr-reveal-answers`).
**Section split (SR-1):** the **課文** authored by capability 1 is the FIVE sections above (`motivation / explain / examples / connections / oral`) and is saved to Postgres — it does **NOT** contain a `practice` section. The **练习** is authored separately by **capability 2** as STRUCTURED data (`stemrobin.sr_questions`), not as HTML inside the 課文. `save-lesson.mjs` enforces this: a 課文 save requires the five anchors and rejects any `practice` section; exercises are written via its `--questions` path.

6. **练习** (structured, authored by **capability 2**) — 8–15 items written to `stemrobin.sr_questions`, one row per item: `type` (**辨认 / 表示 / 操作 / 反推 / 辨错** — coverage MUST span these), `prompt` (KaTeX), `answer_mode` (`choice` | `work`), `options` + `correct_index` for choice items (3–4 options, exactly one correct, distractors grounded in the taught misconceptions), and a hidden `answer` (worked solution, never pre-revealed). `work` items (need steps/explanation) carry no options. Word problems (应用题) are out of scope — exclude them. The card-quiz UI renders these: choice items are answerable in-app with post-answer feedback + answer reveal, work items show a photo-upload placeholder.

**Answers are never revealable by the learner.** Put each answer in `<div class="sr-answer">…</div>` — do NOT use `<details>`/`<summary>` (those let the student click to reveal, which is forbidden). The CSS keeps `.sr-answer` hidden; only a backend signal (adding `body.sr-reveal-answers`) unlocks them for a teacher/answer-key view. Answers never appear in the printed PDF.

## Formulas — KaTeX

All mathematics renders through KaTeX (already wired in the template; auto-render runs on load). Author math as LaTeX inside delimiters: `$...$` inline, `$$...$$` display. Use standard notation (e.g. `\dfrac`, `\lvert x \rvert`, `\times`, `\le`). Never paste images of formulas and never hand-fake math with plain text/Unicode when a real expression is meant. Keep `throwOnError:false` behavior in mind — still, write valid LaTeX.

**Keep expressions short (phone-friendly).** A single line of math must not be wider than a phone screen — long math causes horizontal overflow. Prefer short inline math; break a long derivation into several short display lines rather than one wide one. (Display math that is still long will scroll inside its own box — the CSS handles it — but avoid needing that.)

## Figures — inline SVG

Any number line, axis, graph, geometric figure, or chart is **hand-authored inline `<svg>`** inside `<figure class="sr-fig">` with a `<figcaption>`. Rules:
- Use a `viewBox`, no fixed pixel width; it scales via the template CSS.
- Use the DESIGN palette via literal hex (SVG can't read CSS vars reliably across the frame): blue `#0E7C9B`, green `#15A06A`, ink `#15201F`, dim `#8A9795`, line `#E3EAE9`. White background.
- Label axes, ticks, and key points with `<text>`; a figure with no labels is not acceptable.
- Keep strokes ~1.5–2px, fonts 11–13px. Prefer clarity over decoration.
- The figure must carry real information tied to the explanation, not ornament.

## Identity & persistence contract

- **id**: `<subject>-s<stage>-<order2>`, e.g. `math-s1-01` (stage 1, order 01). `order2` is zero-padded to 2 digits.
- **html_path**: `lessons/<id>.html` (served from `public/`, so the file is written to `public/lessons/<id>.html`).
- **DB**: one row in `stemrobin.sr_lessons` carrying `id, subject, stage, lesson_order, title, concept, html, html_path, status`. New lessons default `status='draft'`. Persistence is done only by `scripts/save-lesson.mjs` — never hand-write the row.
