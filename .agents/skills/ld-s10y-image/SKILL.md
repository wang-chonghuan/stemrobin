---
name: ld-s10y-image
description: Load when creating, repairing, reviewing, or migrating figures for Soviet 10 Years modern-edition lessons, especially geometry, number lines, charts, measured diagrams, semantic illustrations, or hybrid figures that combine GPT Image artwork with exact mathematical overlays.
---

# ld-s10y-image

Create modern textbook figures without asking an image model to preserve exact
mathematics.

## Ownership

This skill owns the complete modern-edition figure workflow:

- authoritative edition-text context
- renderer selection
- `ld-s10y-image/figure-spec@1`
- deterministic geometry and labels
- GPT Image artwork through `n-azure`
- hybrid composition
- mathematical, visual, and cultural review

`ld-s10y-lesson` owns extraction, lesson assembly, edition text, and publishing.
It must delegate modern figure work here.

## Capabilities

### cap1 — Plan one figure

Build context, inspect the edition text and original PNG, select a rendering
mode, and write a draft FigureSpec. Read
[routing.md](references/routing.md) and
[figure-spec.md](references/figure-spec.md).

Update the lesson edition figure entry to exactly one final-output contract:

- `deterministic`: `svg` + `render` + `spec`; remove `png` and `generation`
- `hybrid` or `generated`: `png` + `generation` + `spec`; remove `svg`

```bash
python .agents/skills/ld-s10y-image/scripts/build_context.py \
  --book 5m --edition modern-us-neutral --figure fig-29 \
  --output .tmp/s10y-image/fig-29/context.json
```

The host agent performs semantic interpretation. Deterministic scripts never
guess what the source diagram means.

### cap2 — Render deterministic or hybrid geometry

Validate the spec, then render it with JSXGraph:

```bash
python .agents/skills/ld-s10y-image/scripts/validate_spec.py \
  .tmp/s10y-image/fig-29/spec.json --stage draft

node .agents/skills/ld-s10y-image/scripts/render_spec.mjs \
  --spec .tmp/s10y-image/fig-29/spec.json \
  --svg .tmp/s10y-image/fig-29/fig-29.svg \
  --png .tmp/s10y-image/fig-29/fig-29.png \
  --report .tmp/s10y-image/fig-29/fig-29.svg.json
```

The renderer fails when labels overlap or leave the canvas. Repair the spec
once; do not hand-edit generated SVG paths.

### cap3 — Generate semantic artwork

Read [generation.md](references/generation.md). Use `n-azure` cap4 with the
original PNG and complete edition text. For hybrid figures, generate only the
natural objects or scene; omit grids, measurements, coordinates, labels, and
answer-bearing annotations. Request a transparent background when practical.

### cap4 — Review and promote

Read [quality-gate.md](references/quality-gate.md). A figure is promotable only
when:

1. FigureSpec validation passes.
2. Render report status is `pass` for deterministic or hybrid output.
3. Mathematical and cultural visual review passes.
4. `review.status` is set to `pass`.
5. The lesson edition validator and offline lesson render pass.

Preview under `.tmp/`. Do not overwrite edition assets or write the database
before approval.

## Non-negotiable rules

- Edition text is authoritative; the original PNG supplies visual structure.
- Never use an answer key to construct a question figure.
- Use deterministic geometry for points, lines, grids, axes, ticks, dimensions,
  coordinates, transformations, and mathematical labels.
- Hybrid artwork must preserve its intrinsic aspect ratio. FigureSpec `size`
  is a centered contain box, never permission to stretch an image.
- A central-symmetry or half-turn claim requires a `centralSymmetry` assertion
  covering every defining opposite point pair. Never represent the claimed
  symmetric object as an unchecked free-form `svgPath`.
- Use GPT Image only for semantic artwork. In hybrid output, artwork is below
  the deterministic overlay.
- Visible labels are English; mathematical symbols and numbers are allowed.
- Use teal and green app accents with natural object colors.
- Do not copy Cyrillic, Chinese, Soviet symbols, flags, uniforms, handwriting,
  old-book texture, or cultural wording from source pixels.
- No silent fallback. A failed assertion, collision, or visual gate blocks
  promotion.
