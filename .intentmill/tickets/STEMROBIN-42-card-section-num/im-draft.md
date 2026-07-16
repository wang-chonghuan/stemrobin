# im-draft — STEMROBIN-42 · card-section-num

## Problem
The card 精读 section title (`.sr-card-section`) shows only `card.name` (中文名, e.g. "为什么学这个"),
with no section number. Its color is `--sr-blue-deep` (#0A5E76) at 13px — a dark, desaturated
teal that reads as near-black and is not prominent (seed grill G-B: "全黑不明显").

## Fix
1. Render **number + name**: prefix `card.num` before `card.name` → "1 为什么学这个".
2. Change the color to a **prominent accent** using existing `--sr-*` tokens: switch to the
   brighter primary teal `--sr-blue` (#0E7C9B) and bump size/weight so it clearly reads as an
   accent label, not plain black.

## Scope
- `app/src/components/card-reader.tsx` — the `.sr-card-section` render.
- `app/src/styles/app.css` — the `.sr-card-section` rule.
- No new hue (reuse `--sr-blue`), no new dependency, zh/en identical (num+name are language-neutral).

## Non-goals
- No change to the lesson title (`.sr-card-lesson`), read-check flow, iframe, or i18n keys.
