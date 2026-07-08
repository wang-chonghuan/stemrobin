# resources/reference/DESIGN.md Guide

Use this guide before reading, writing, or applying `resources/reference/DESIGN.md`.

## Purpose

`resources/reference/DESIGN.md` is the repository's plain-text design-system source for agents. It should describe stable visual identity, layout rules, component patterns, interaction conventions, and content tone clearly enough that future UI work can preserve StemRobin's design without rediscovering it from code.

This guide follows the Google Labs `design.md` format/spec principle that a design file should be structured, self-contained, and useful to coding agents as a persistent design-system contract.

## Authoritative References

Use these sources when this guide does not answer a new design-documentation question, when changing `resources/reference/DESIGN.guide.md` itself, or when checking whether the current guidance still matches the latest official/spec or common-practice expectations. Routine `resources/reference/DESIGN.md` updates do not require reading these links first when this guide already gives clear direction.

- Official Google Labs `design.md` repository:
  - https://github.com/google-labs-code/design.md
- Official Google Labs `design.md` format specification:
  - https://github.com/google-labs-code/design.md/blob/main/docs/spec.md
- Google Stitch `resources/reference/DESIGN.md` overview and format docs:
  - https://stitch.withgoogle.com/docs/design-md/overview
  - https://stitch.withgoogle.com/docs/design-md/format
- CLI/package reference:
  - https://www.npmjs.com/package/design-md
- Community examples and best-practice references:
  - https://designmd.app/
  - https://getdesign.md/
  - https://github.com/VoltAgent/awesome-design-md

When these links do not answer the question, do additional targeted research and record any durable rule changes in this guide. Use the official repository, spec, and Google-hosted docs as the authority when sources disagree. Use community resources only as examples of structure, workflow, or practical usage patterns.

## How To Use resources/reference/DESIGN.md

- Read `resources/reference/DESIGN.md` before changing StemRobin UI.
- Treat the implemented tokens in `app/src/styles/app.css` (the `--sr-*` variables) as the CSS source of truth when values conflict.
- Use `resources/reference/DESIGN.md` to preserve visual language; do not use it to add product scope.
- When a ticket changes layout or design rules, update `resources/reference/DESIGN.md` in the same ticket.

## How To Edit resources/reference/DESIGN.md

- Keep it concise and structured with sections for tokens, typography, layout, components, icons, interaction states, and content tone.
- Record stable rules and numeric layout contracts that future agents must preserve.
- Distinguish active rules from obsolete mockup constraints. Remove obsolete constraints when they would mislead future work.
- Do not duplicate large code blocks or implementation details that belong in source files.
- Do not invent new colors, typography, components, or workflows unless the ticket explicitly requires them.

## What Belongs In resources/reference/DESIGN.md

- Design tokens and their source of truth.
- Typography and spacing rules.
- App-shell layout contracts and responsive breakpoints.
- Component-level visual conventions.
- Icon and asset usage rules.
- Interaction-state expectations.
- Content tone constraints.

## What Does Not Belong In resources/reference/DESIGN.md

- Ticket plans, temporary TODOs, or implementation logs.
- Backend, API, database, auth, or deployment details.
- Test results or verification transcripts.
- Product features not represented in the implemented app.
