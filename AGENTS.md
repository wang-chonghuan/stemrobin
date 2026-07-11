# AGENTS.md — router

Entry point for AI coding agents on this repo. This is a **thin router**: it holds no
knowledge itself, only behavioral guidelines + where each kind of knowledge lives.
Read the routed file directly; don't duplicate its content here.

## Behavioral baseline

- Follow the engineering rules in `.prodfarm/charter/engineering-rules.md` (think-before-coding, simplicity, surgical changes, goal-driven verification, SSOT).
- This repo runs the **n-prodfarm** product-autonomy loop: human decides at batch boundaries; the machine executes inside a batch. The `.prodfarm/charter/` is **frozen inside a batch** — propose charter changes as boundary settlement, never edit mid-batch.
- Verify by actually running the product (browser / runbook commands), never by imagining from code.

## Where knowledge lives

| Question | Home |
|---|---|
| Product goal / north star | `.prodfarm/charter/goal.md` (human-only) |
| Hard boundaries needing human approval | `.prodfarm/charter/redlines.md` |
| Engineering norms a coder must obey | `.prodfarm/charter/engineering-rules.md` |
| Architecture decisions + stack & constraints | `.prodfarm/charter/architecture.md` |
| Dev / build / test / deploy / ops commands | `.prodfarm/charter/runbook.md` |
| What the product currently has (feature registry) | `.prodfarm/features/` |
| What happened (dev timeline) | `.prodfarm/timeline/` |
| Batch archives (story list, grill, report) | `.prodfarm/batches/` |
| Machine-current module facts (reverse-engineered) | `.evodocs/modules/` |
| Ticket spec / test basis | the ticket in the backend (plane) + its `refs/` |
| UI design tokens & rules | `resources/reference/DESIGN.md` (+ `resources/reference/DESIGN.guide.md`) |
| Content-generation skills | `.agents/skills/` (`sr-math-lesson`, `sr-story`) |

## Frozen directories

- `.evodocs/constitution.md` and `.evodocs/index.json` are legacy read-only history. Add no new dependencies on them; route persistent intent to `.prodfarm/charter/` and machine-current module facts to `.evodocs/modules/`.
