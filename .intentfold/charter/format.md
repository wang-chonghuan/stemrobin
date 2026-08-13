# How a charter file is written

Read this before writing or editing anything in `charter/`. It applies to the files laid down at
initialization **and to every later edit by anyone** — human or machine.

The charter is the only place this project's intent lives. It is read by people who have never seen
the repo and by agents that will act on it within seconds. That is why its shape is fixed.

## Four sections, in this order

Every charter file is made of these four, always in this order and always all four:

```markdown
## Contract     — what the artifact IS
## Tools        — what you ACT WITH
## Guidance     — how to DO the work
## Redlines     — what you must NOT do
```

They are not four strength levels from soft to hard. They are **four different things to state**, and
each one is consumed at a different moment, in a different way:

| Section | States | How it is consumed | Who enforces it |
|---|---|---|---|
| **Contract** | the product / the shape / the facts | **referenced** while authoring — built *from*, never "checked against" at the end | a static check, where the fact is mechanisable |
| **Tools** | commands, paths, ports, URLs, viewports, where an account lives | **looked up at the moment of acting** and run | the command's own failure |
| **Guidance** | how to approach the work | **followed while writing** | the author's judgement — deliberately no after-the-fact review |
| **Redlines** | the boundary | **looked up before the action**, table-style | a lookup, and a stop |

**All four headings are always present, in every charter file.** A section with nothing to say keeps
its heading and stays **empty** — no "none", no "n/a", no placeholder sentence.

An empty section is a statement: *this dimension has nothing of that kind.* Dropping the heading
instead would leave a reader unable to tell "there is nothing here" from "somebody forgot", and the
second reading is the one that makes an agent go looking elsewhere — or invent it. The four headings
are also how the flow addresses the file: a capability that says "look up this file's `## Redlines`"
must find that heading, and find it empty, rather than fail to find it and have to decide what that
meant.

## The three tests that decide where a line goes

Getting these wrong is the failure this format exists to prevent, so apply the test rather than the
feeling.

**1. Contract or Guidance? — does it describe the artifact, or the act?**
*"Label is 14px/500"* describes the artifact → Contract.
*"Use Heading 4 for a body-sized title"* describes what you do → Guidance.

**2. Guidance or Redline? — can it be decided without reading the code?**
If crossing it is visible from a path, a pattern, or a structural fact → **Redline**.
If deciding takes judgement or a read-through → **Guidance**, always.
A "redline" that needs someone to study a diff is a Guidance line that was filed in the wrong
section, and it does real damage: it cannot be looked up, so it gets skipped, and a list with
skippable entries stops being looked up at all.

**3. Is it Tools? — will it go stale?**
Commands, paths, ports, URLs, viewports, account locations — anything with a concrete value that a
future change can invalidate → **Tools**, and it appears there **once**. Elsewhere, point at it;
never restate it. A restated command is a stale command waiting to happen: the copy is not updated
when the original is.

## What each section may not do

- **Contract** does not tell anyone what to do. If it contains an imperative, that sentence belongs
  in Guidance.
- **Tools** is never paraphrased into a ticket artifact, a plan, or another charter file. It is read
  fresh, at the moment of use, and run as written. Remembering a command from earlier in the run is
  the specific bug this section exists to prevent.
- **Guidance is binding.** It is not advice and not a preference — the only difference from a redline
  is *who decides whether it was met*: the author, while writing, rather than a lookup afterwards.
  Nothing in this skill reviews a diff against Guidance, and that is deliberate. State it so an
  author can follow it, not so a reviewer can score it.
- **Redlines** is a closed list, looked up and never judged. Every entry says which of the two it
  is — **forbidden outright**, or **not without the human's explicit approval**. Entries hold whether
  or not anyone thought of them when the plan was written.

## Where a rule lives

**In the file whose dimension it belongs to** — the UI prohibition in `ui.md`, the deploy one in
`devops.md`. There is no separate redline file, and adding one is a regression: a file organised by
severity sits among files organised by subject, so it attracts every rule anyone thinks is important
and fills with copies of rules that already have a home.

Prohibitions that hold on **every** project — destructive writes to external systems, irreversible
production data, spending money, editing the charter — are hard rules in the skill's `SKILL.md` and
are not repeated in any project's charter.

## Editing this charter later

- Keep all four headings, in order, even where a section is empty. A new line goes into the section
  its **test** puts it in, not the section it is nearest to, and not the section that happens to have
  content already.
- **Prefer making a rule mechanical over writing it more forcefully.** A rule a script can check is
  worth more than the same rule in bold: name the check in `Tools` and let the build fail. Rewriting
  an unenforceable rule in stronger language only trains readers to skim it.
- When a Contract fact changes, look for the `Tools` entry and the static check that encode it. A
  contract changed in prose but not in the check is a contract that no longer holds.
- The charter is human-owned. An agent reports drift and proposes; it does not edit `charter/` on its
  own initiative.
