# Runbook — running this project locally

Concrete, directly executable commands, repo-root-relative. No machine-specific absolute paths.
Environment-specific values are placeholders plus how to obtain them.
Section shape is fixed — see `format.md`.

This is the file acceptance verification uses to start the product, so an out-of-date command here
silently blocks every ticket. **Read it at the moment you need it and run it as written** — never
from memory, never restated into a plan or a ticket artifact. Keep it true.

## Contract

<What actually runs: the services, which of them are long-running, what each one serves. Two lines.
Enough that "start the product" is unambiguous when the project has more than one process.>

## Tools

**Install**

```bash
<command>
```

**Run the dev server**

Every long-running service starts on its fixed main port from `.dimleaper/project.json`:

```bash
<command>
```

For a ticket worktree, resolve every service's port with:

```bash
python3 <n-dimleaper-skill>/scripts/ports.py .dimleaper/project.json ticket <ticket-id>
```

State how each returned port is passed into its service — the env var or flag:

```bash
<frontend command with the web port injected>
<backend command with the api port injected>
```

**Build**

```bash
<command>
```

**Run tests**

```bash
<command>
```

**Environment**

<Which env files exist, which keys are required, and where to get their values. Never write actual
secrets here.>

## Guidance

**Troubleshooting** — <the failures that actually happen and what to do about them. A startup failure
is a stop and a report, never an acceptance result.>

## Redlines

**A closed list, looked up — never judged.** Do not ask "is this a big deal?"; check whether the
action is on the list. If it is: **route around it, or stop and hand it to the human.** Never
proceed, never approximate, never decide on the human's behalf.

Every entry says which of the two it is — **forbidden outright**, or **not without the human's
explicit approval**. An entry that needs a read-through to apply is not a redline; write it as
Guidance instead (`format.md`, test 2).

1. **<A command that must never be run against a shared or production environment>** — <which of the
   two>. Delete the entry if the project has none — **keep the heading**, empty; the flow looks this
   section up by name and an empty one is the answer "nothing forbidden here".
