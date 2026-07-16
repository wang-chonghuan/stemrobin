# im-spec — STEMROBIN-42 · card-section-num

## Behavior
The current card's 精读 section title renders as **`{num} {name}`** (e.g. "1 为什么学这个"),
styled as a **prominent teal accent** (`--sr-blue`, 15px/700), sitting under the lesson title.

## Acceptance (black-box)
- AC1: The section title text starts with the section number then the name — "1 为什么学这个".
- AC2: The section title computed color is a prominent accent (rgb of `--sr-blue` ≈ rgb(14,124,155)),
  clearly not black (not rgb(0,0,0) / near-black ink).
- AC3: The lesson title (`.sr-card-lesson`, the `label`) still renders above it.
- AC4: The read-check flow (answer → pass → 下一张) is unchanged.

## Contracts / tokens
- `card.num` (number, from ReadingCard) → number prefix; `card.name` (中文名) → name.
- Color token: `--sr-blue` (#0E7C9B). No new hue, no new dependency, no i18n key.

## Files
- `app/src/components/card-reader.tsx`
- `app/src/styles/app.css`
