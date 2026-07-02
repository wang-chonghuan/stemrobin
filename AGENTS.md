# AGENTS.md - AI Agent Rules

This file is the entry point for AI coding agents. It defines baseline project rules for future work in this repository.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them; don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No flexibility or configurability that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't improve adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it; don't delete it.

When your changes create orphans:

- Remove imports, variables, and functions that your changes made unused.
- Don't remove pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" becomes "Write tests for invalid inputs, then make them pass."
- "Fix the bug" becomes "Write a test that reproduces it, then make it pass."
- "Refactor X" becomes "Ensure tests pass before and after."

For multi-step tasks, state a brief plan:

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

Strong success criteria let you loop independently. Weak criteria require clarification.

## 5. SSOT and One Way Only

**A system should have one source of truth, one canonical way to perform each operation, and no fallback for states that should be impossible.**

Before changing design, schema, workflow, or control flow:

- Keep exactly one source of truth for each important contract, schema, or decision.
- Do not create parallel definitions, duplicate configs, shadow workflows, or competing entry points.
- For each operation, keep one canonical implementation path instead of multiple partially overlapping ways.
- For states that should be impossible, do not add fallback behavior just to keep the system running.
- If the source of truth is missing, inconsistent, or violated, fail fast and surface the error directly.

Ask yourself: "Am I introducing a second source of truth, a second execution path, or a fallback that hides an impossible state?" If yes, stop and redesign it.
