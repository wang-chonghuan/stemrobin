# Development Rules

Human-authored. Binding on every coding agent working in this repo.
Section shape is fixed — see `format.md`.

## Contract

<Often empty in this file — what the code *is* usually belongs to `arch.md` (structure, stack) and
`ui.md` (design system). Put something here only if this project has development facts that live
nowhere else: a language version the whole repo is pinned to, a directory layout convention that is
stated as fact rather than as an instruction.>

## Tools

**The mechanical defence** — the one command that makes this project's checkable rules fail rather
than be remembered. Run it once before the handoff; it is not a review pass, it is a command:

```bash
<lint / typecheck / contract-check command, or the build if the checks hang off it>
```

<Any other command a coding agent runs against its own work: formatter, codegen, schema validation.
Named once here; pointed at from everywhere else, never restated.>

## Guidance

Binding. Followed while writing, judged by the author — nothing reviews a diff against this section.

**No gratuitous dependencies.** If the existing architecture and stack can implement the requirement,
**do not add, remove, or change any library**. Solve it with what is here. A dependency change is
admissible only when the existing stack genuinely cannot meet the requirement **and** the ticket
carries that decision — which means the human made it, at the grill or earlier. Finding the stack
insufficient with no such decision is a stop, never a silent install.

**Reuse before inventing.** Existing helpers, config paths, schemas, components and SSOT files come
first. A second way to do something that already has a way is a defect, even when it works.

**No dirty code.** No TEMP markers, no degradation branches, no mock standing in for a failed external
dependency. A failing external premise is a stop and a report, not something to route around. These
patterns get learned and copied — one of them breeds more.

**Surgical changes.** Touch what the ticket needs and nothing else. Do not "improve" adjacent code,
reformat unrelated files, or fix things you noticed in passing — report them instead so they can
become their own ticket.

**Uncertainty surfaces.** Prefer stopping and asking over inventing a fallback or a hidden
compatibility layer.

<Add this project's own guidance below: SSOT discipline, validation, DB access, git workflow, naming
and style conventions, anything cross-cutting a coding agent must obey while writing. If a line here
could instead be enforced by a command, move it to Tools and make the command fail — that is worth
more than stating it more forcefully.>

## Redlines

**A closed list, looked up — never judged.** Do not ask "is this a big deal?"; check whether the
action is on the list. If it is: **route around it, or stop and hand it to the human.** Never
proceed, never approximate, never decide on the human's behalf.

Every entry says which of the two it is — **forbidden outright**, or **not without the human's
explicit approval**. An entry that needs a read-through to apply is not a redline; write it as
Guidance instead (`format.md`, test 2).

1. **Committing credentials, tokens, connection strings, or hidden account data** — forbidden
   outright, in source, mocks, ticket artifacts and commits alike.
2. **Discarding a change already present in a dirty worktree** — forbidden outright. It is the
   human's work until they say otherwise.
3. **<A pattern this project will not tolerate in shipped code>** — forbidden outright. <Keep it
   detectable from a path or a token, not from reading the logic.>
