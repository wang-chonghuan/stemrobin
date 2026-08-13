# .intentfold

Read this at the start of every session in this repo, and revisit it whenever you have been away from
it for a while.

*Machine-owned: `intentfold` cap1 rewrites this file from its template. It says where things live, not
what this project wants — that is `charter/`, which is yours and which cap1 only creates when absent and never reopens once it exists. Do not
hand-edit here; edits belong in the charter or in the skill.*

## Read in this order

1. `.intentfold/project.json` — project name, main branch, deploy target, ticket backend (`plane` or
   `linear`) with its project URL, and each service's fixed main port plus ticket prefix.
2. `.intentfold/charter/` — **every dimension file in it**. This is binding intent, not background
   reading:
   - `product.md` — what this product is and who it is for
   - `dev.md` — development rules a coding agent must obey
   - `ui.md` — UI requirements, tokens, patterns
   - `arch.md` — architecture decisions and constraints
   - `runbook.md` — how to run, build and debug locally
   - `qa.md` — how this project is tested
   - `devops.md` — how it is deployed and operated

   Each of them is written in the same four sections, and **each section is used differently** —
   `charter/format.md` states the shape and the tests, and is worth reading once:

   | Section | Use it by |
   |---|---|
   | `## Contract` | referencing it while you author — it is what the thing *is* |
   | `## Tools` | looking it up **at the moment you act** and running it as written; never from memory |
   | `## Guidance` | following it while you write; nobody reviews a diff against it |
   | `## Redlines` | looking the action up **before** doing it. Never judged. Forbidden outright, or not without the human |

   Hard prohibitions live at the end of the file they belong to. There is no separate redline file.
3. The ticket you are working on, live from the ticket backend — never from a local copy.
4. `.intentfold/tickets/<ticket-id>/` — the artifacts of the ticket in hand.

## What lives where

- Requirements live in the **ticket backend** named by `project.json` `tickets.system` — plane or
  linear, read and written only through the **n-plane** / **n-linear** skill. There is no local copy.
  Ticket text follows the backend's language: linear is English, plane is Chinese unless the human
  asks otherwise.
- Intent lives in `charter/`. It is **human-owned**: read it, never edit it. Report drift instead.
- Per-ticket contracts live in `tickets/<ticket-id>/`: `ticket.json` (branch, base, ports, and
  `status: open | closed`), `plan.md`, `ac.md`, `grill.md`, `handoff.md`, and `rework.md` when there
  was any. **`ticket.json` `status` is how you tell live work from finished work** without asking the
  backend. **Read them in that order and read both of the
  last two** — `handoff.md` is frozen at first delivery, so `rework.md` is what says what is actually
  true now.
- Scratch lives in `tmp/` (project) and `tickets/<id>/tmp/` (ticket). Neither is committed.

## How work happens

Through the **intentfold** skill, which owns the workflow — this file does not repeat it. One ticket
at a time: worktree → plan/ac → grill → code → verify the acceptance criteria with playwright →
handoff → merge.

No change without a ticket.
