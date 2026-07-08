Read `resources/reference/DESIGN.guide.md` before reading, writing, or using this `resources/reference/DESIGN.md`.

# StemRobin Design System

StemRobin is a learning app that delivers middle-school-standard math and physics to a young, high-comprehension learner, one small concept at a time. The UI should feel **compact, clean, and school-serious**: a pure white workspace, dense practical hierarchy, and quiet focus rather than playful edutainment. No mascots, no marketing layout, no decorative gradients beyond the single brand mark.

## Palette

Exactly three colors carry the identity — **teal-blue, green, and pure white** — over a neutral ink scale for text. Do not introduce additional hues.

```yaml
color:
  white: "#FFFFFF"        # the only page/background surface (pure white)
  panel: "#F5F9F9"        # faint cool wash — sidebar, headers, hover fills
  card: "#FFFFFF"
  blue: "#0E7C9B"         # primary — teal-blue (actions, selection, links)
  blue_deep: "#0A5E76"    # primary hover / active
  blue_tint: "#E1F1F5"    # selected row, info chip background
  green: "#15A06A"        # accent — mastery, correct, success
  green_deep: "#0F7D52"
  green_tint: "#E4F6EE"
  ink: "#15201F"          # primary text
  ink_soft: "#4C5A58"     # secondary text
  ink_dim: "#8A9795"      # metadata, captions
  line: "#E3EAE9"         # borders
  line_soft: "#EEF3F2"
radius:
  card: "10px"
  control: "8px"
  pill: "999px"
layout:
  catalog: "236px"
  mobile_breakpoint: "860px"
  app_shell_height: "100dvh"
```

Tokens are implemented as `--sr-*` CSS variables in `app/src/styles/app.css` — that file is the source of truth when values conflict. The shadcn `--primary` token is also mapped to the teal-blue so default `Button` components match.

## Typography

- Display: `Bricolage Grotesque`, fallback `Geist Variable`, system sans. Used for brand, titles, card titles.
- Body: `Hanken Grotesk`, fallback `Geist Variable`, system sans.
- Numeric/mono: `JetBrains Mono`, for any quantity, answer key, or coordinate.
- Operational labels (eyebrows, group headings, counts) stay small and dense. Do not scale type with viewport width.

## Layout

- The app shell fills the viewport like a web app (`100dvh`); never center it in a canvas or leave wide-screen gutters.
- Two-pane workspace: a fixed **236px catalog** on the left and a flexible detail pane. There is no right assistant pane.
- The catalog is the subject/stage navigator. It hides below the 860px breakpoint (mobile shows the detail pane full-width); a drawer can be added later.
- Detail pane = a slim top bar (icon + view title) over a scrolling content area with **20px padding**.
- Spacing is deliberately compact: 15px card padding, 12px grid gaps, 14px section gaps. Prefer density over whitespace, but keep lines readable (line-height ~1.5–1.6 for prose).
- Do not add hero sections, nested cards, or decorative section cards. Cards hold one concrete content module each.

## Components

- **Catalog item**: a flat compact button row — 17px lucide stroke icon, 8px radius, `ink_soft` text. Hover fills `card`; selected uses `blue_tint` background with `blue_deep` text. A trailing pill `--sr-count` shows lesson counts in `line_soft`/`ink_dim`.
- **Brand mark**: a single rounded square with a teal-blue→green gradient and a lucide glyph (graduation cap). This is the only gradient in the system.
- **Card**: `card` background, `line` border, 10px radius, 15px padding. Title in display type; body in `ink_soft`.
- **Chips**: info/blue chips use `blue_tint`/`blue_deep`; mastery/green chips use `green_tint`/`green_deep`. Small outline `--sr-tag` for status labels like 草稿.
- **Buttons**: primary is solid `blue`, hover `blue_deep`; ghost is transparent with a `line` border and `panel` hover. Compact height (~9px vertical padding).
- **Eyebrow**: uppercase, letter-spaced, `ink_dim` label above titles; `.accent` variant in `blue_deep`.
- **Empty state**: centered icon tile (`blue_tint`), short display heading, one dim sentence. Used when a subject has no lessons yet.

## Lesson Rendering

A lesson is four sections plus a typed exercise set (see `app/src/lib/lessons.ts`). Label the four sections by subject:

- Math: 今天学什么 · 讲清楚 · 做几个 · 自己试
- Physics: 看到什么 · 怎么测 · 讲清楚 · 自己试

Exercise types map to quiet category tags, not colorful badges: 辨认 / 表示 / 操作 / 反推 / 解释 / 辨错. Mastery checks and the closing "最容易错在哪里" question are rendered as a compact list, not a celebratory callout.

## Icons

- Use `lucide-react` stroke icons for all navigation and functional glyphs, matching the app's thin-stroke style (subject icons, view title, empty state).
- There is no separate brand-artwork asset set; the gradient brand mark + a lucide glyph is the whole brand expression.

## Interaction States

- Selection updates the detail view, the view title, and the selected-row state.
- Focus states use a 2px teal-blue (`blue`) outline with a 1px offset.
- Respect reduced motion by disabling transitions and animation inside the app.

## Content Tone

- Copy is direct, concrete, and serious — the tone of a good teacher, not a cartoon. Chinese UI copy.
- Do not write encouragement filler or science-story fluff (mirrors `resources/content/course-gen-guide-common.md` 禁止事项).
- Always land on formal terms; intuitive phrasing is an entry ramp, never a replacement for the definition.
