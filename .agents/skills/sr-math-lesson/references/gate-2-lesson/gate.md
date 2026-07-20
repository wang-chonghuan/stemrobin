# Gate 2 — 課文 HTML (fast, 抓大放小)

Run after cap2, before cap3/cap4. An independent reviewer receives the content/overlay (or HTML), ledger JSON, and contract. For a group, one reviewer may assess every page, but must give each lesson its own Pass/Fail verdict.

**Be fast. Time-box it (a few minutes for a group, not a line-by-line audit).** The deterministic scripts (`check-content`, `check-blueprint`) already enforce structure, anchors, KEY-free overlay, and figure-text consistency — **do not re-verify what they cover.** Your only job is the handful of things a script cannot judge and that actually break learning. Catch the big rocks; do not nitpick wording, style, or count every item.

## First cause

After reading this, can the learner (a) point at an instance and name its parts, (b) do the move, (c) say WHY — and did the text give them a **picture before a definition**? A text that only narrates definitions fails.

## Big rocks — verify these, fail on any (this is the gate)

1. **Math wrong** — any worked-example answer or read-check keyed option that is actually incorrect. Highest value; check the numbers/logic, not the prose.
2. **判据先行 (no intuition)** — a new term whose **opening** is the formal criterion ("有…性质的…叫…") with no plain-language mental image first. Per the contract's 先直觉后形式 rule, each `introduces` term must lead with a one-line intuitive image on a concrete instance, THEN the precise criterion. Definition-first is a fail.
3. **Vocabulary breach** — a technical term used that is neither taught here (`introduces`) nor in an earlier `introduces`/`assumed`. (Skim for wild jargon; the obvious ones only.)
4. **方法课: move decreed, not derived** — the move stated as a recipe with no derivation the learner could re-give.

## Quick scan — glance only, flag if OBVIOUSLY broken (do not exhaustively verify)

Boundary cases roughly covered; each introduced term shown on a concrete instance at least once; oral has ~4+ hidden-answer items; tone not lecture-filler/cartoon-metaphor. If nothing jumps out on a quick read, pass it — do not hunt.

## Scope Limit

No browser/PDF/mobile QA here (that is the single cap4 pass). No re-checking structure the scripts already validated.

## Pass

No big-rock failure: math is right, every new term leads with intuition then formalizes, language is speakable, 方法课 moves are derived. Then cap3/cap4 may proceed.
