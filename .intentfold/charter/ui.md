# UI Requirements

Binding on every UI change. **UI work follows this file strictly** — the agent does not invent
alternatives to what is written here. Section shape is fixed — see `format.md`.

Anything this file does not cover is still a design decision: it is settled at the **grill**, by the
human, before implementation. Never invented while coding.

> `.prodfarm/charter/` had no UI file — the design system lives in `resources/reference/DESIGN.md`
> and has since before this harness. This file **points at it** rather than restating it, per
> `format.md` ("a restated value is a stale value waiting to happen"). Filled in 2026-08-05; the
> parts marked *observed* describe how the repo is today, not a decision the human has recorded.

## Contract

**Styling stack — Tailwind**

This project runs **Tailwind CSS 4** (+ tw-animate-css) with shadcn components. The intentfold
default (Astryx + StyleX) does **not** apply here: the two stacks are exclusive, and this project
chose Tailwind. Astryx and StyleX are not used at all.

**Design source of truth**

`resources/reference/DESIGN.md` is the design system of record — palette, radii, layout metrics,
typography, per-component specs, and lesson-section labelling. **Read
`resources/reference/DESIGN.guide.md` first**; `DESIGN.md` itself says so, and it explains how the
document is meant to be read and written.

Where a value in `DESIGN.md` and the code disagree, **`app/src/styles/app.css` is the source of truth
for the value** — that is where the tokens actually live — and the disagreement is drift to report.

**Tokens**

Every style value is a token. The registries, by path:

- `app/src/styles/app.css` — the `--sr-*` CSS variables. The implementation SSOT.
- `resources/reference/DESIGN.md` — the documented vocabulary the variables realize.

The palette is closed: **exactly three colors carry the identity — teal-blue, green, and pure
white — over a neutral ink scale. No additional hues.** The full list of names and values is in
`DESIGN.md`; do not copy it here and do not approximate a colour that is not in it. `--sr-font` is
the single global font token (Inter, system sans fallback); display, body and numeric roles reference
it rather than defining their own family. The shadcn `--primary` token is mapped to the teal-blue so
default `Button` components match.

**Layout and responsive**

App-shell layout, fixed 236px catalog, 860px mobile breakpoint, 100dvh shell, compact spacing scale —
all specified in `DESIGN.md`. Every UI change is checked at both viewports named in `qa.md`.

**Component structure** — *observed*: components are flat under `app/src/components/` (e.g.
`catalog.tsx`, `card-reader.tsx`, `quiz-drawer.tsx`), with shadcn primitives alongside. The
intentfold template's atoms/molecules/organisms layout is **not** in use.
TODO(human) — decide whether to keep the flat layout or move to atomic design. Until then, a new
component goes next to its peers in `app/src/components/` and this file is not evidence for a
restructure.

## Tools

There is no UI-specific static check today. The mechanical defence is the project-wide one in
`dev.md`:

```bash
cd app && npm run test && npm run build
```

TODO(human) — a check that fails on a raw hex colour or an off-palette hue in `app/src/` would be
worth more than any of the prose above. Until it exists, the palette rule is Guidance enforced by the
author.

Design reference: `resources/reference/DESIGN.guide.md`, then `resources/reference/DESIGN.md`.
shadcn/ui docs: https://ui.shadcn.com

## Guidance

Binding. Followed while writing, judged by the author — nothing reviews a diff against this section.

**Choosing components.** Reach for a custom component only when shadcn genuinely has nothing that
fits — not because the official one needs configuring, and not because writing one looks faster.
"There is no equivalent" is a claim to check against the docs, not to assume.

**Choosing a token.** Use the `--sr-*` variable, never a raw hex value and never a Tailwind palette
colour that happens to look close. A missing token is a **stop**, not a reason to compose one out of
primitives.

**The look this product is going for.** Compact, clean, school-serious: a pure white workspace, dense
practical hierarchy, quiet focus. No mascots, no marketing layout, no decorative gradients beyond the
single brand mark, no hero sections, no nested cards. Density over whitespace — but prose stays
readable (line-height ~1.5–1.6). `DESIGN.md` has the specifics.

**Interaction states.** Loading, empty, error, disabled and focus are part of the change, not a
follow-up. `DESIGN.md` specifies the empty state (centred icon tile, short display heading, one dim
sentence).

**Content and tone.** The reader is an 8-year-old working alone. Labels are plain and short; the four
lesson-section labels are fixed per subject in `DESIGN.md` and are not reworded.

## Redlines

**A closed list, looked up — never judged.** Do not ask "is this a big deal?"; check whether the
action is on the list. If it is: **route around it, or stop and hand it to the human.** Never
proceed, never approximate, never decide on the human's behalf.

Every entry says which of the two it is — **forbidden outright**, or **not without the human's
explicit approval**. An entry that needs a read-through to apply is not a redline; write it as
Guidance instead (`format.md`, test 2).

1. **Changing a governed token registry** — adding, renaming, removing or retuning a value — not
   without the human's explicit approval. The registries, by path, so this can be matched against a
   diff without judgement: `app/src/styles/app.css`, `resources/reference/DESIGN.md`.
2. **Introducing a colour outside the three-colour palette plus the ink scale** — forbidden outright.
   Detectable as a raw hex or an `rgb(`/`hsl(` literal added under `app/src/` outside those two files.
3. **Recreating the brand mark** — forbidden outright. It is `app/public/logo-mark.png` (derived from
   `resources/lemmadeck-logo.png`); never substitute a Lucide glyph or a CSS shape, and never restretch
   or re-crop it.
4. **Introducing a second styling mechanism** — StyleX, Astryx, CSS-in-JS, or a new global stylesheet —
   forbidden outright. Tailwind plus `app/src/styles/app.css` is the whole of it.
