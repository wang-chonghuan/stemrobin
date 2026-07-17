# AI Agent Session Bootstrap

Use this file as the entry point for every new AI-agent session in this
repository. Complete the bootstrap before planning work, editing files, changing
runtime state, or creating tickets.

This file is a router, not a copy of project knowledge. Read the authoritative
sources below directly so the session uses their current contents.

## 1. Load Repository Instructions

Read `AGENTS.md` first.

Active system and developer instructions take precedence. Repository-level
instructions in `AGENTS.md` take precedence over this bootstrap if they
conflict.

## 2. Load Product Intent And Engineering Policy

Read every file under `.prodfarm/charter/`, including:

1. `goal.md`
2. `redlines.md`
3. `engineering-rules.md`
4. `architecture.md`
5. `runbook.md`

Treat the charter as the authoritative source for product intent, approval
boundaries, engineering policy, architecture decisions, and operational
commands. Do not casually modify it. Apply the ownership and freeze rules
defined by `n-prodfarm`.

## 3. Load Current Module Knowledge

Read `.evodocs/modules/module-index.json`.

Use the index to identify every module relevant to the user's request. Read each
matching module document under `.evodocs/modules/`, including relevant parent
documents. A module path such as `area/child` maps to
`.evodocs/modules/mod--area--child.md`.

Evodocs describes reverse-engineered current state, not product intent. Verify
task-critical facts against current source code before making changes.

If the evodocs index does not exist, report the missing harness facility instead
of inventing module boundaries. In a charter-only repository, continue from the
charter and source code unless the user requests full harness initialization.

## 4. Load And Follow `n-prodfarm`

Load the installed `n-prodfarm` skill and read its complete `SKILL.md` from the
active agent's skill registry. Common user-level locations include:

- Codex: `~/.agents/skills/n-prodfarm/SKILL.md`
- Claude: `~/.claude/skills/n-prodfarm/SKILL.md`
- OpenCode: `~/.config/opencode/skills/n-prodfarm/SKILL.md`

Use the current **Entry Routing** table in that skill to select exactly one
capability before acting. Do not rely on capability summaries copied into old
prompts or remembered from prior sessions.

For a full prodfarm repository, `n-prodfarm` is the workflow authority. It must
create or locate the required in-progress ticket before product code, content,
configuration, database state, or runtime state changes. Invoke partner skills
through the capability contracts instead of reimplementing their workflows.

## 5. Establish Live Working State

Before acting, inspect:

- Current Git branch, upstream, and dirty status.
- `.prodfarm/meta.json` when present.
- Active ticket or batch state required by the selected capability.
- Relevant source code and tests identified through evodocs.

Do not discard, overwrite, or revert pre-existing workspace changes unless the
user explicitly authorizes it.

## 6. Continue The User's Request

After loading the context:

1. State the selected `n-prodfarm` capability and why it matches the request.
2. Name the charter and evodocs module documents used for grounding.
3. Identify any redline, approval, dirty-worktree, missing-ticket, or missing
   harness blocker.
4. If the user already supplied a task and no blocker exists, continue the
   workflow immediately rather than stopping for confirmation.
5. If no task was supplied, report that the repository context is loaded and
   wait for the task.

The user should only need to say:

> Read `SESSION-BOOTSTRAP.md` and follow it, then handle my request.
