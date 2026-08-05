# AGENTS.md — router

Entry point for AI coding agents on this repo. This is a **thin router**: it holds no
knowledge itself, only behavioral guidelines + where each kind of knowledge lives.
Read the routed file directly; don't duplicate its content here.

## Behavioral baseline

- Follow the development rules in `.dimleaper/charter/dev.md` (they are binding, not advisory).
- This repo runs the **n-dimleaper** one-ticket-at-a-time loop: no product change without a ticket in the backend `.dimleaper/project.json` names. `.dimleaper/charter/` is human-owned — an agent reports drift, never edits it.
- Verify by actually running the product (browser / runbook commands), never by imagining from code.

## Where knowledge lives

| Question | Home |
|---|---|
| Session entry — read this first | `.dimleaper/readme.md` |
| Product intent / what good looks like | `.dimleaper/charter/product.md` (human-only) |
| Hard boundaries needing human approval | the `## Redlines` section of each `.dimleaper/charter/` file |
| Engineering norms a coder must obey | `.dimleaper/charter/dev.md` |
| Architecture decisions + stack & constraints | `.dimleaper/charter/arch.md` |
| Dev / build / test commands | `.dimleaper/charter/runbook.md` |
| Deploy / ops commands | `.dimleaper/charter/devops.md` |
| How the product is tested, test account | `.dimleaper/charter/qa.md` |
| UI stack, tokens, design rules | `.dimleaper/charter/ui.md` → `resources/reference/DESIGN.md` |
| Machine-current module facts (reverse-engineered) | `.evodocs/modules/` |
| Ticket spec / acceptance criteria | the ticket in plane, live — never a local copy |
| Content-generation skills | `.agents/skills/` (`sr-story`, `sr-voa1500`, `ld-galaxy`, `ld-s10y-image`) |
| Soviet 10 Years 教材 → lesson / exercise | `.claude/skills/ld-s10y-lesson/`（现代图委托 `ld-s10y-image`；产物在 `resources/s10y-lessons/`） |
| Soviet 10 Years 书后答案 → answer | `.claude/skills/ld-s10y-answer/` |

## Frozen directories

Read-only history. Add no new dependencies on them; persistent intent lives in `.dimleaper/charter/`
and machine-current module facts in `.evodocs/modules/`.

- `.prodfarm/` — the previous product loop, superseded by `.dimleaper/` on 2026-08-05. Its charter was
  migrated into `.dimleaper/charter/`; `batches/`, `timeline/` and `features/` are kept as history.
- `.intentmill/` — per-ticket artifacts from the earlier n-im flow.
- `.evodocs/constitution.md` and `.evodocs/index.json`.

## Project context

Read `.dimleaper/readme.md` first — it routes to this project's intent (`.dimleaper/charter/`) and
its ticket workflow. No product change without a ticket in the backend `.dimleaper/project.json` names;
use the `n-dimleaper` skill.
