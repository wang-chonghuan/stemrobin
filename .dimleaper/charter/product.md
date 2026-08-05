# Product

Human-authored. The machine reads this as binding intent and never edits it.
Section shape is fixed — see `format.md`.

## Contract

**What this product is**

<One paragraph a newcomer could read and know what they are building. Not a feature list.>

**Who it is for**

<The actual users, and what they are trying to get done.>

**What good looks like**

<How you would know this product is succeeding. The standard a ticket is ultimately judged against.>

**What this product is not**

<Deliberate non-goals. The most useful part of this file — it is what stops scope from drifting
outward one reasonable-sounding ticket at a time. State them as facts about the product; anything
phrased as "never do X" is a redline and belongs below, where it will actually be looked up.>

## Tools

<Usually empty in this file — product intent has no commands. Leave the heading and nothing under it.>

## Guidance

<Usually empty in this file. If you find yourself writing "how to build it" here, it belongs in
`dev.md`, `arch.md` or `ui.md`.>

## Redlines

**A closed list, looked up — never judged.** Do not ask "is this a big deal?"; check whether the
action is on the list. If it is: **route around it, or stop and hand it to the human.** Never
proceed, never approximate, never decide on the human's behalf.

Every entry says which of the two it is — **forbidden outright**, or **not without the human's
explicit approval**. An entry that needs a read-through to apply is not a redline; write it as
Guidance instead (`format.md`, test 2).

1. **<What this product must never become>** — forbidden outright. <The removed feature that must not
   come back, the shape it must not take. Keep it detectable: name the route, the file, the
   dependency, so crossing it is visible without judgement.>
2. **Editing this file** — forbidden outright. Product intent is the human's exclusively.
