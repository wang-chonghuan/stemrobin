# Architecture

Human-authored decisions and constraints — "how this is built", as decided, not as it happens to look
right now. Where code and this file disagree, this file is the target and the drift gets reported.
Section shape is fixed — see `format.md`.

The dependency inventory is not written here; the lockfile is its source of truth.

## Contract

**Stack**

<What this project standardizes on. State it as fact — "X is the application framework", "Y is the
only styling authority". What must not be introduced is a redline, below.>

**Structure**

<The modules or layers, what each owns, and the boundaries between them. Enough that an agent can
tell where a change belongs before it starts writing.>

**Key decisions**

<Decisions worth carrying forward, each with the reason. A decision without its reason gets
re-litigated by the next agent that finds it inconvenient.>

## Tools

<Paths and commands that encode the architecture and go stale when it moves: the build output the
server is run from, the generated files that must never be hand-edited, the command that asserts a
structural rule. Named once, here; pointed at from everywhere else.>

## Guidance

**Complexity hotspots**

<Places that are harder than they look, and why. This is where lessons from things that went wrong
belong — it is what makes the next grill sharper.>

<How to approach a change in this architecture: what to reach for first, what to reuse before
inventing, which boundary to respect when the shortest path would cross it.>

## Redlines

**A closed list, looked up — never judged.** Do not ask "is this a big deal?"; check whether the
action is on the list. If it is: **route around it, or stop and hand it to the human.** Never
proceed, never approximate, never decide on the human's behalf.

Every entry says which of the two it is — **forbidden outright**, or **not without the human's
explicit approval**. An entry that needs a read-through to apply is not a redline; write it as
Guidance instead (`format.md`, test 2).

1. **<Structural dependency that must never be introduced>** — forbidden outright. <e.g. one module
   reaching into another's private internals. Name the directories, so crossing it is visible from a
   path.>
2. **Adding, removing or changing a dependency** — not without the human's explicit approval, and
   only when a ticket carries that decision.
3. **<Hand-editing a generated file>** — forbidden outright. <Name the file or the glob.>
