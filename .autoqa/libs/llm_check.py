#!/usr/bin/env python3
"""AutoQA semantic gate (LLM judge).

Provisioned by n-autoqa capability 1 into ``<repo>/.autoqa/libs/llm_check.py``.

Role boundary
-------------
This module only *reviews* generated content against a rubric. It never
generates test data. Test data comes from either the product's real
entrypoints or schema-validated crafted seed rows; a test-side LLM inventing
data at run time is forbidden by the AutoQA data-fixture contract.

Configuration
-------------
All settings come from ``<repo>/.autoqa/ssot-config.json`` under
``semanticCheck``:

    {
      "baseURL": "...",            # OpenAI-compatible endpoint
      "envKey": "...",             # env var holding the API key
      "model": "...",              # deployment/model name
      "reasoningEffort": "medium",
      "envLoader": {               # optional: project module that can inject
        "module": "path/to/module.py",   # repo-relative python file
        "callable": "function_name",
        "arg": "repo-relative-path-or-null"  # passed as pathlib.Path if set
      }
    }

Fail-hard policy
----------------
Missing config, missing API key after the env loader ran, missing client
library, or an unreachable endpoint raises ``SemanticGateUnavailable``.
Tests must let this propagate as an infrastructure failure. Silently
skipping the gate is forbidden.

Grading policy
--------------
The judge is deliberately lenient: it passes unless the content clearly
violates the rubric. It blocks obvious garbage (fabricated numbers,
placeholders, assertive wording where hedged wording is required, content
unrelated to its subject). It is not a quality reviewer; deep quality
evaluation belongs to a separate eval workflow.

CLI
---
    python llm_check.py --rubric "..." --content "..."
    python llm_check.py --rubric-file r.txt --content-file c.txt

Exit codes: 0 = pass, 1 = fail (with reason on stdout as JSON),
2 = gate unavailable (infrastructure failure).
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from pathlib import Path
from typing import Any

SYSTEM_PROMPT = (
    "You are a strict regression sanity checker. Return ONLY JSON "
    '{"pass": bool, "reason": str}. Pass unless the content clearly '
    "violates the rubric. Judge only what the rubric asks; do not "
    "invent extra requirements."
)


class SemanticGateUnavailable(RuntimeError):
    """The judge cannot run. This is an infrastructure failure, not a test fail."""


class SemanticGateBadVerdict(RuntimeError):
    """The judge responded with something that is not a usable verdict."""


def find_repo_root(start: Path | None = None) -> Path:
    """Walk upward until a directory containing .autoqa/ssot-config.json is found."""
    current = (start or Path.cwd()).resolve()
    for candidate in [current, *current.parents]:
        if (candidate / ".autoqa" / "ssot-config.json").is_file():
            return candidate
    raise SemanticGateUnavailable(
        "Cannot locate .autoqa/ssot-config.json above %s; run n-autoqa capability 1 first."
        % (start or Path.cwd())
    )


def load_semantic_check_config(repo_root: Path) -> dict[str, Any]:
    config_path = repo_root / ".autoqa" / "ssot-config.json"
    try:
        config = json.loads(config_path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise SemanticGateUnavailable(f"Cannot read {config_path}: {exc}") from exc

    semantic = config.get("semanticCheck")
    if not isinstance(semantic, dict):
        raise SemanticGateUnavailable(
            f"{config_path} has no semanticCheck section; rerun n-autoqa capability 1."
        )
    missing = [key for key in ("baseURL", "envKey", "model", "reasoningEffort") if not semantic.get(key)]
    if missing:
        raise SemanticGateUnavailable(
            f"semanticCheck section is missing required field(s): {', '.join(missing)}"
        )
    return semantic


def _run_env_loader(semantic: dict[str, Any], repo_root: Path) -> None:
    loader = semantic.get("envLoader")
    if not isinstance(loader, dict):
        return
    module_rel = loader.get("module")
    callable_name = loader.get("callable")
    if not module_rel or not callable_name:
        raise SemanticGateUnavailable(
            "semanticCheck.envLoader must define both 'module' and 'callable'."
        )
    module_path = repo_root / module_rel
    if not module_path.is_file():
        raise SemanticGateUnavailable(f"envLoader module does not exist: {module_path}")

    spec = importlib.util.spec_from_file_location("autoqa_env_loader", module_path)
    if spec is None or spec.loader is None:
        raise SemanticGateUnavailable(f"Cannot import envLoader module: {module_path}")
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
        loader_fn = getattr(module, callable_name)
        arg = loader.get("arg")
        if arg:
            loader_fn(Path(repo_root / arg))
        else:
            loader_fn()
    except SemanticGateUnavailable:
        raise
    except Exception as exc:  # fail-hard: any loader failure is an infra failure
        raise SemanticGateUnavailable(
            f"envLoader {module_rel}::{callable_name} failed: {exc}"
        ) from exc


def ensure_api_key(semantic: dict[str, Any], repo_root: Path) -> str:
    env_key = semantic["envKey"]
    value = os.environ.get(env_key)
    if value:
        return value
    _run_env_loader(semantic, repo_root)
    value = os.environ.get(env_key)
    if value:
        return value
    raise SemanticGateUnavailable(
        f"API key env var {env_key} is not set, and the configured envLoader "
        "(if any) did not inject it. The semantic gate cannot run."
    )


def semantic_gate(
    rubric: str,
    content: str,
    repo_root: Path | None = None,
) -> dict[str, Any]:
    """Judge ``content`` against ``rubric``.

    Returns ``{"pass": bool, "reason": str}``.
    Raises ``SemanticGateUnavailable`` on any infrastructure problem.
    """
    if not rubric or not rubric.strip():
        raise ValueError("rubric must be a non-empty string")
    if content is None:
        raise ValueError("content must not be None")

    root = repo_root or find_repo_root()
    semantic = load_semantic_check_config(root)
    api_key = ensure_api_key(semantic, root)

    try:
        from openai import OpenAI  # imported lazily for a clearer failure message
    except ImportError as exc:
        raise SemanticGateUnavailable(
            "The 'openai' package is not installed in this environment; "
            "install it in the project venv that runs AutoQA tests."
        ) from exc

    client = OpenAI(base_url=semantic["baseURL"], api_key=api_key)
    try:
        response = client.chat.completions.create(
            model=semantic["model"],
            reasoning_effort=semantic["reasoningEffort"],
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"RUBRIC: {rubric}\nCONTENT: {content}"},
            ],
        )
    except Exception as exc:
        raise SemanticGateUnavailable(f"Semantic gate call failed: {exc}") from exc

    raw = response.choices[0].message.content
    try:
        verdict = json.loads(raw)
    except (TypeError, json.JSONDecodeError) as exc:
        raise SemanticGateBadVerdict(f"Judge returned non-JSON verdict: {raw!r}") from exc
    if not isinstance(verdict, dict) or not isinstance(verdict.get("pass"), bool):
        raise SemanticGateBadVerdict(f"Judge verdict has no boolean 'pass': {verdict!r}")
    verdict.setdefault("reason", "")
    return verdict


def assert_semantic_gate(rubric: str, content: str, target: str = "") -> dict[str, Any]:
    """Convenience for tests: raise AssertionError with the judge's reason on fail.

    The verdict (pass or fail) should also be persisted to the case's
    run-artifacts by the caller so failures are attributable later.
    """
    verdict = semantic_gate(rubric, content)
    if not verdict["pass"]:
        label = f" [{target}]" if target else ""
        raise AssertionError(f"semantic gate failed{label}: {verdict.get('reason', '')}")
    return verdict


def _read_arg_or_file(value: str | None, file_value: str | None, name: str) -> str:
    if value is not None:
        return value
    if file_value is not None:
        return Path(file_value).read_text()
    raise SystemExit(f"Either --{name} or --{name}-file is required")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="AutoQA semantic gate CLI")
    parser.add_argument("--rubric")
    parser.add_argument("--rubric-file")
    parser.add_argument("--content")
    parser.add_argument("--content-file")
    args = parser.parse_args(argv)

    rubric = _read_arg_or_file(args.rubric, args.rubric_file, "rubric")
    content = _read_arg_or_file(args.content, args.content_file, "content")

    try:
        verdict = semantic_gate(rubric, content)
    except (SemanticGateUnavailable, SemanticGateBadVerdict) as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 2
    print(json.dumps(verdict, ensure_ascii=False))
    return 0 if verdict["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
