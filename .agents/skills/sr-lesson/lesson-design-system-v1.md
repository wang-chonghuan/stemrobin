# Lesson Design System v1

The visual + structural contract every StemRobin lesson follows. Captured from the 合并同类项 (`math-s2-06`) lesson — that look is the baseline. Storage-format-agnostic: it applies whether a lesson's 课文 is authored as an HTML fragment or its exercises are rendered from JSON. It shares the app palette in `resources/reference/DESIGN.md` but owns the **content** components (sections, callouts, examples, exercises, figures, inline marks).

**Conformance:** lessons use only these tokens and classes. Colours come from tokens, never hard-coded in content. Content carries semantic classes only — **no inline styles** — so the stylesheet is the single place to restyle. Add a new component here and in the stylesheet together; do not invent ad-hoc classes in a lesson.

## Tokens

```css
:root{
  --sr-white:#FFFFFF; --sr-panel:#F5F9F9; --sr-card:#FFFFFF;
  --sr-blue:#0E7C9B; --sr-blue-deep:#0A5E76; --sr-blue-tint:#E1F1F5;   /* primary / terms / info */
  --sr-green:#15A06A; --sr-green-deep:#0F7D52; --sr-green-tint:#E4F6EE; /* accent / pitfall / mastery */
  --sr-ink:#15201F; --sr-ink-soft:#4C5A58; --sr-ink-dim:#8A9795;        /* text scale */
  --sr-line:#E3EAE9; --sr-line-soft:#EEF3F2;                            /* borders */
  --sr-radius:10px; --sr-radius-sm:8px;
  --sr-display:"Bricolage Grotesque","Hanken Grotesk",system-ui,sans-serif; /* titles */
  --sr-body:"Hanken Grotesk",system-ui,sans-serif;                          /* prose */
  --sr-mono:"JetBrains Mono",ui-monospace,monospace;                        /* numbers / tags */
}
```

Three colours carry the identity — teal-blue, green, pure white — over the neutral ink scale. Do not add hues.

## Structure

- One lesson renders inside `.sr-lesson` (max-width **760px**, centered). Content padding is a fixed, deliberate **`24px 22px 40px`** (top / sides / bottom). The bottom (40px) is intentional — enough that the last item isn't jammed, short enough not to look like a gap. Do not change it per-lesson.
- Header: `.sr-l-eyebrow` (e.g. `数学 · 第 2 阶段`) · `.sr-l-title` · `.sr-l-concept`.
- Six sections, in order, each a `.sr-sec-label` (a `.sr-sec-num` badge + `.sr-sec-name`) then content:
  1. **为什么学这个** (引子问题) 2. **讲解** 3. **例题** 4. **与其他知识点的联系** 5. **概念口试** 6. **练习**.
- **概念口试 (5)** = `<ol class="sr-oral">` of 4–6 short conceptual Q&A (builds the concept network, not calculation). **练习 (6, last)** = the exercises. In both, each answer is a hidden `<div class="sr-answer">` — **not revealable by the learner** (no `<details>` toggle).

## Runtime features (v2)

Every lesson carries these; the app's lesson view drives the two buttons.

- **Responsive math** — a math line must never overflow the phone width; keep expressions short. Long display math scrolls inside its own box (`.katex-display { overflow-x:auto }`), never the page.
- **定义正例/反例** — right after each definition in 讲解, a `<div class="sr-eg">` with `<span class="yes">正例…</span>` / `<span class="no">反例…</span>` (2–4 short items) illustrates it. Not worked examples.
- **答案对学生完全隐藏、不可点开** — each answer is a `<div class="sr-answer">…</div>` (NOT `<details>` — no toggle, the learner cannot reveal it). CSS keeps `.sr-answer { display:none }`; only a backend signal (`body.sr-reveal-answers`) unlocks them for teacher/answer-key. Never shown in the PDF.
- **下载 PDF** — the PDF is **pre-generated at save time** by `scripts/save-lesson.mjs` (headless Chromium via playwright-core, at authoring/build time only) into a static `public/lessons/<id>.pdf`. The download button is a plain `<a href="/lessons/<id>.pdf" download>` — instant, no print dialog, and the deployed app needs **no browser at runtime**. Page size **A4**; print rules: 练习 starts on a new page (`page-break-before`), each practice `<li>` gets full-width rules above/below with writing space (groundwork for machine-reading handwritten work), answers hidden.
- **Fonts (critical for the PDF)** — the Google-Fonts `@import` (Bricolage / Hanken / JetBrains Mono / **Noto Sans SC**) MUST be the **first line inside `<style>`, before `:root`** — an `@import` after any rule is invalid per spec and silently dropped (this once made web fonts fail and Chinese vanish from the PDF). **Noto Sans SC** must be in the `--sr-body` / `--sr-display` stacks so Chinese has a real, embeddable font (headless-Chromium PDF does not apply the system CJK fallback).

## Inline styling — bold, colored terms, highlighted sentences

This is what the current lesson uses for emphasis; conform to it.

- **Bold** — `<strong>` (ink, weight 600). Markdown `**…**` maps to this.
- **Formal term (colored word)** — `<span class="sr-term">数轴</span>` → blue-deep, weight 600. Use the first time a standard term appears. Markdown/authoring convention: `:term[…]`.
- **Inline highlight / emphasis colour** (optional) — `.sr-hl` (blue-tint background), `.sr-key` (green-deep). Keep the set small.
- **Highlighted sentence with a background (the "阴影")** — this is block-level: a **callout** (below), not an inline mark.

## Components

```css
/* base */
.sr-lesson{max-width:760px;margin:0 auto;padding:24px 22px 40px; /* top 24 / sides 22 / bottom 40 — deliberate, moderate; keep this */
  font-family:var(--sr-body);color:var(--sr-ink);line-height:1.6}
.sr-lesson p{margin:10px 0;font-size:15px}
.sr-lesson strong{color:var(--sr-ink)}
.sr-lesson code{font-family:var(--sr-mono);font-size:.92em;background:var(--sr-panel);padding:1px 5px;border-radius:5px}

/* header */
.sr-l-head{border-bottom:1px solid var(--sr-line);padding-bottom:16px}
.sr-l-eyebrow{color:var(--sr-blue-deep);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.sr-l-title{margin:6px 0 4px;font-family:var(--sr-display);font-size:26px;font-weight:700;letter-spacing:-.02em;line-height:1.15}
.sr-l-concept{color:var(--sr-ink-soft);font-size:14.5px}

/* section label */
.sr-lesson section{margin-top:26px}
.sr-sec-label{display:flex;align-items:baseline;gap:10px;margin-bottom:10px}
.sr-sec-num{font-family:var(--sr-mono);font-size:13px;font-weight:600;color:#fff;background:var(--sr-blue);border-radius:6px;padding:1px 8px}
.sr-sec-name{font-family:var(--sr-display);font-size:18px;font-weight:600}
.sr-lesson h3{font-family:var(--sr-display);font-size:15.5px;font-weight:600;margin:18px 0 6px}

/* inline marks */
.sr-term{color:var(--sr-blue-deep);font-weight:600}
.sr-hl{background:var(--sr-blue-tint);border-radius:4px;padding:0 3px}
.sr-key{color:var(--sr-green-deep);font-weight:600}

/* callouts — highlighted sentences with a tinted background + left border */
.sr-callout{border-left:3px solid var(--sr-blue);background:var(--sr-blue-tint);
  border-radius:0 8px 8px 0;padding:10px 14px;margin:14px 0;font-size:14px}
.sr-callout.pitfall{border-left-color:var(--sr-green);background:var(--sr-green-tint)} /* 易错 */
.sr-callout.question{border-left-color:var(--sr-blue-deep)}                             /* 驱动问题 */
.sr-callout p:first-child{margin-top:0}.sr-callout p:last-child{margin-bottom:0}
.sr-callout b,.sr-callout strong{color:var(--sr-ink)}

/* display math (KaTeX renders inside) */
.sr-mathblock{margin:14px 0;text-align:center;overflow-x:auto}

/* figure — inline SVG */
figure.sr-fig{margin:14px 0;text-align:center}
figure.sr-fig svg{max-width:100%;height:auto;border:1px solid var(--sr-line);border-radius:8px;background:var(--sr-white)}
figure.sr-fig figcaption{margin-top:6px;color:var(--sr-ink-dim);font-size:12px}

/* worked example */
.sr-example{border:1px solid var(--sr-line);border-radius:var(--sr-radius);padding:12px 16px;margin:12px 0;background:var(--sr-card)}
.sr-example-h{font-family:var(--sr-display);font-size:14.5px;font-weight:600;margin-bottom:4px}
.sr-step{display:flex;gap:10px;margin:6px 0;font-size:14.5px}
.sr-step-n{flex:none;font-family:var(--sr-mono);font-size:12px;font-weight:600;color:var(--sr-blue-deep)}

/* practice + answers */
ol.sr-practice{padding-left:0;list-style:none;counter-reset:p;margin:6px 0 0}
ol.sr-practice>li{counter-increment:p;position:relative;padding:10px 0 10px 34px;border-top:1px solid var(--sr-line-soft);font-size:14.5px}
ol.sr-practice>li:first-child{border-top:0}
ol.sr-practice>li::before{content:counter(p);position:absolute;left:0;top:10px;width:22px;height:22px;display:grid;place-items:center;border-radius:6px;background:var(--sr-panel);color:var(--sr-ink-soft);font:600 11.5px var(--sr-mono)}
.sr-ptype{display:inline-block;margin-right:6px;border-radius:5px;padding:0 6px;background:var(--sr-blue-tint);color:var(--sr-blue-deep);font-size:10.5px;font-weight:700;vertical-align:1px}
details.sr-answer{margin-top:6px}
details.sr-answer summary{color:var(--sr-blue-deep);font-size:12.5px;font-weight:600;cursor:pointer;list-style:none}
details.sr-answer summary::-webkit-details-marker{display:none}
details.sr-answer summary::before{content:"▸ "}
details.sr-answer[open] summary::before{content:"▾ "}
details.sr-answer .sr-answer-body{margin-top:5px;color:var(--sr-ink-soft);font-size:14px}
.sr-answer-shown{margin-top:6px;color:var(--sr-ink-soft);font-size:14px;border-left:2px solid var(--sr-green);padding-left:10px}
.sr-answer-locked{margin-top:6px;color:var(--sr-ink-dim);font-size:12.5px;font-style:italic}

```

## Formulas

All math via **KaTeX**. Author as LaTeX in `$…$` (inline) / `$$…$$` (display); standard notation (`\dfrac`, `\lvert x\rvert`, `x^2`). A standalone display equation may use a `.sr-mathblock` wrapper. Never fake math with plain text or images.

## Figures — inline SVG

Hand-authored `<svg>` inside `<figure class="sr-fig">` with a `<figcaption>`:
- Use a `viewBox`, no fixed pixel width (it scales).
- Use DESIGN colours as **literal hex** (SVG can't read the CSS vars reliably): blue `#0E7C9B` / blue-deep `#0A5E76` / green `#15A06A` / green-deep `#0F7D52` / ink `#15201F` / dim `#8A9795` / line `#E3EAE9`; white background.
- Label axes, ticks, key points with `<text>` (11–13px). A figure with no labels is not acceptable. Strokes ~1.5–2px.

## Answer visibility

Answers are **hidden by default**, and a learner cannot reveal an answer themselves. Visibility is granted by **user state**: a global backend signal (to be implemented later) updates the user's state to unlock specific answers, and the frontend renders an answer only when the current user state permits it.

- Not unlocked → the exercise shows a locked placeholder (`.sr-answer-locked`), never the answer.
- Unlocked (per user state) → the answer renders (`.sr-answer-shown`).

The exercise carries the answer content but **no self-reveal toggle** — answers stay out of the learner's reach unless the backend decides otherwise (e.g. after completion, or a teacher unlock). The unlock mechanism is out of scope here; just render answers hidden by default and reveal per user state. (`details.sr-answer` styling, if present, is only for authoring/teacher preview, not the learner default.)

## Version

**v1** — baseline captured from `math-s2-06` (合并同类项). Bump the version and note changes when the visual language changes; keep old lessons rendering by keeping the classes stable.
