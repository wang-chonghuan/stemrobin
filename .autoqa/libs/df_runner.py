#!/usr/bin/env python3
"""AutoQA data-fixture runner: owner-scoped snapshot / diff / restore engine.

Provisioned by n-autoqa capability 1 into ``<repo>/.autoqa/libs/df_runner.py``.

Responsibility split
--------------------
* This file: project-agnostic algorithm only — owner-scoped table discovery,
  full-row snapshot, diff-based restore, big-table sentinels, start-state
  verification, declarative seeding with JSONB schema validation, process
  prep steps, environment guard, failure scene dump, and crash-safe
  reconciliation of pending snapshots.
* ``<repo>/.autoqa/libs/db_adapter.py``: the ONLY project-specific piece.
  Written once per repo (and human-reviewed) against the canonical DB modules
  named in ``.autoqa/ssot-config.json`` ``db``. It must expose:

      execute(sql: str, params: Sequence | None = None) -> None
      fetch(sql: str, params: Sequence | None = None) -> list[dict]
      current_env() -> str          # e.g. "local" / "dev" / "prod"
      default_schema() -> str

  Contract details:
  - Placeholders are PostgreSQL-style ``$1..$n``.
  - ``fetch`` must decode json/jsonb columns into Python objects
    (dict/list), not strings.
  - Both calls must go through the project's canonical connection module;
    never a hand-rolled connection string.

SQL dialect: discovery/diff SQL targets PostgreSQL (information_schema,
``to_jsonb``, ``jsonb_populate_record``). Non-PostgreSQL projects must adapt
inside their adapter or fork this template at provisioning time.

Lifecycle (see the n-autoqa data-fixture contract reference)
------------------------------------------------------------
Session (whole regression run):
    reconcile_pending() -> snapshot(environment) -> clean(start tables)
    ... run cases ...
    restore(environment snapshot)

Case:
    verify_empty(start tables)      # trust the previous case; fail loud if dirty
    snapshot(case)
    prep steps (process / seed)
    ... test runs the real entrypoint ...
    restore(case snapshot)          # on failure: dump scene, then restore

Safety rules baked in (not configurable):
* Every destructive statement is owner-scoped: WHERE clauses on the owner
  columns are appended by this runner; callers cannot omit them.
* TRUNCATE is never emitted. Tables outside the owner scope are never touched.
* The current environment must be allowed by both the case manifest and the
  ssot-config write policy, and must not be denied.
* Snapshots are persisted to disk before any destructive step, and a pending
  snapshot can always be reconciled later (crash safety).
"""

from __future__ import annotations

import argparse
import datetime as _dt
import importlib.util
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterable, Sequence

BIG_TABLE_ROW_LIMIT = 10_000  # above this, snapshot keeps a sentinel, not rows


class DfRunnerError(RuntimeError):
    """Base class for all runner failures."""


class EnvironmentDenied(DfRunnerError):
    """Current environment is not allowed for destructive fixture work."""


class StartStateDirty(DfRunnerError):
    """A case found residue at its start. The previous case's reset failed,
    or an external writer touched the scope. Do not clean silently."""


class InputDrift(DfRunnerError):
    """Shared precondition data changed since its fingerprint baseline."""


class SentinelViolation(DfRunnerError):
    """A big (sentinel-mode) table changed during the run; it was expected
    to be read-only and cannot be restored automatically."""


class PrepStepFailed(DfRunnerError):
    """A prep step (process command or seed) failed. Attribution: upstream,
    not the entrypoint under test."""


class SeedValidationError(DfRunnerError):
    """Seed rows violate scope or JSONB schema requirements."""


def _now_stamp() -> str:
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")


def find_repo_root(start: Path | None = None) -> Path:
    current = (start or Path.cwd()).resolve()
    for candidate in [current, *current.parents]:
        if (candidate / ".autoqa" / "ssot-config.json").is_file():
            return candidate
    raise DfRunnerError(
        f"Cannot locate .autoqa/ssot-config.json above {start or Path.cwd()}; "
        "run n-autoqa capability 1 first."
    )


def _load_adapter(repo_root: Path):
    adapter_path = repo_root / ".autoqa" / "libs" / "db_adapter.py"
    if not adapter_path.is_file():
        raise DfRunnerError(
            f"{adapter_path} is missing. Author the per-repo adapter (four "
            "callables: execute/fetch/current_env/default_schema) against the "
            "canonical DB modules in ssot-config.json.db, then retry."
        )
    spec = importlib.util.spec_from_file_location("autoqa_db_adapter", adapter_path)
    if spec is None or spec.loader is None:
        raise DfRunnerError(f"Cannot import adapter: {adapter_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for name in ("execute", "fetch", "current_env", "default_schema"):
        if not callable(getattr(module, name, None)):
            raise DfRunnerError(f"Adapter {adapter_path} does not expose callable '{name}'")
    return module


def _qualify(schema: str, table: str) -> str:
    return table if "." in table else f"{schema}.{table}"


def _split_qualified(qualified: str, default_schema: str) -> tuple[str, str]:
    if "." in qualified:
        schema, table = qualified.split(".", 1)
        return schema, table
    return default_schema, qualified


class DfRunner:
    def __init__(self, repo_root: Path | None = None, adapter: Any | None = None):
        self.repo_root = repo_root or find_repo_root()
        self.config = json.loads((self.repo_root / ".autoqa" / "ssot-config.json").read_text())
        self.db_config = self.config.get("db") or {}
        self.adapter = adapter or _load_adapter(self.repo_root)
        self.schema = self.adapter.default_schema()
        self.artifacts_root = self.repo_root / ".autoqa" / "run-artifacts"
        self.snapshots_dir = self.artifacts_root / "snapshots"
        self._fk_edges_cache: list[tuple[str, str]] | None = None

    # ------------------------------------------------------------------
    # Environment guard
    # ------------------------------------------------------------------
    def guard_write_policy(self) -> str:
        """ssot-config write-policy check. Called by EVERY destructive
        operation (clean/seed/restore/reconcile), not only by case_setup,
        so no code path can delete or write in a denied environment."""
        env = self.adapter.current_env()
        policy = self.db_config.get("writePolicy") or {}
        denied = policy.get("deniedEnvironments") or []
        allowed = policy.get("allowedEnvironments")
        if env in denied:
            raise EnvironmentDenied(f"Environment '{env}' is denied by ssot-config write policy.")
        if allowed is not None and env not in allowed:
            raise EnvironmentDenied(
                f"Environment '{env}' is not in ssot-config allowedEnvironments {allowed}."
            )
        return env

    def guard_environment(self, allow_reset_environments: Sequence[str]) -> str:
        env = self.guard_write_policy()
        if env not in allow_reset_environments:
            raise EnvironmentDenied(
                f"Environment '{env}' is not in this manifest's allowResetEnvironments "
                f"{list(allow_reset_environments)}."
            )
        return env

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------
    def discover_scoped_tables(self, owner_scope: dict[str, Any]) -> list[dict[str, Any]]:
        """Every table in the default schema that carries at least one owner
        column is in scope. The WHERE clause for a table uses the owner
        columns that the table actually has."""
        if not owner_scope:
            raise DfRunnerError("owner_scope must not be empty")
        rows = self.adapter.fetch(
            "SELECT table_name, column_name FROM information_schema.columns "
            "WHERE table_schema = $1",
            [self.schema],
        )
        by_table: dict[str, set[str]] = {}
        for row in rows:
            by_table.setdefault(row["table_name"], set()).add(row["column_name"])
        scoped = []
        for table, columns in sorted(by_table.items()):
            scope_cols = [col for col in owner_scope if col in columns]
            if scope_cols:
                scoped.append({"table": table, "scope_columns": scope_cols})
        return scoped

    def _scope_where(self, scope_cols: Sequence[str], owner_scope: dict[str, Any], start_index: int = 1):
        clauses = []
        params: list[Any] = []
        for offset, col in enumerate(scope_cols):
            clauses.append(f'"{col}" = ${start_index + offset}')
            params.append(owner_scope[col])
        return " AND ".join(clauses), params

    def _primary_key(self, table: str) -> list[str]:
        rows = self.adapter.fetch(
            "SELECT kcu.column_name FROM information_schema.table_constraints tc "
            "JOIN information_schema.key_column_usage kcu "
            "ON kcu.constraint_name = tc.constraint_name "
            "AND kcu.table_schema = tc.table_schema "
            "WHERE tc.table_schema = $1 AND tc.table_name = $2 "
            "AND tc.constraint_type = 'PRIMARY KEY' ORDER BY kcu.ordinal_position",
            [self.schema, table],
        )
        return [row["column_name"] for row in rows]

    def _fk_edges(self) -> list[tuple[str, str]]:
        """(child_table, parent_table) pairs inside the default schema."""
        if self._fk_edges_cache is None:
            rows = self.adapter.fetch(
                "SELECT tc.table_name AS child, ccu.table_name AS parent "
                "FROM information_schema.table_constraints tc "
                "JOIN information_schema.constraint_column_usage ccu "
                "ON ccu.constraint_name = tc.constraint_name "
                "AND ccu.table_schema = tc.table_schema "
                "WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1",
                [self.schema],
            )
            self._fk_edges_cache = [(r["child"], r["parent"]) for r in rows]
        return self._fk_edges_cache

    def order_children_first(self, tables: Iterable[str]) -> list[str]:
        """Topological order where children come before parents (delete order).
        Reverse it for insert order. Cycles fall back to input order."""
        tables = list(tables)
        table_set = {t.split(".")[-1] for t in tables}
        edges = [(c, p) for c, p in self._fk_edges() if c in table_set and p in table_set and c != p]
        remaining = set(table_set)
        ordered: list[str] = []
        for _ in range(len(table_set) + 1):
            leaves = {
                t for t in remaining
                if not any(parent == t and child in remaining and child != t for child, parent in edges)
            }
            if not leaves:
                break
            ordered.extend(sorted(leaves))
            remaining -= leaves
        ordered.extend(sorted(remaining))  # cycle fallback
        original = list(tables)
        return sorted(original, key=lambda t: ordered.index(t.split(".")[-1]))

    # ------------------------------------------------------------------
    # Snapshot
    # ------------------------------------------------------------------
    def snapshot(self, owner_scope: dict[str, Any], label: str) -> Path:
        """Full-content, owner-scoped snapshot of every scoped table.
        Persisted to disk *before* any destructive step and marked pending
        until successfully reconciled (restored or explicitly settled)."""
        tables = self.discover_scoped_tables(owner_scope)
        snap: dict[str, Any] = {
            "label": label,
            "created_at": _now_stamp(),
            "schema": self.schema,
            "environment": self.adapter.current_env(),
            "owner_scope": owner_scope,
            "reconciled": False,
            "tables": {},
        }
        for entry in tables:
            table, scope_cols = entry["table"], entry["scope_columns"]
            qualified = _qualify(self.schema, table)
            where, params = self._scope_where(scope_cols, owner_scope)
            count = self.adapter.fetch(
                f"SELECT count(*) AS n FROM {qualified} WHERE {where}", params
            )[0]["n"]
            if count > BIG_TABLE_ROW_LIMIT:
                checksum = self.adapter.fetch(
                    f"SELECT md5(string_agg(md5(to_jsonb(t.*)::text), '' ORDER BY md5(to_jsonb(t.*)::text))) AS c "
                    f"FROM {qualified} t WHERE {where}",
                    params,
                )[0]["c"]
                snap["tables"][table] = {
                    "mode": "sentinel",
                    "scope_columns": scope_cols,
                    "count": count,
                    "checksum": checksum,
                }
            else:
                rows = self.adapter.fetch(
                    f"SELECT to_jsonb(t.*) AS r FROM {qualified} t WHERE {where}", params
                )
                snap["tables"][table] = {
                    "mode": "full",
                    "scope_columns": scope_cols,
                    "primary_key": self._primary_key(table),
                    "rows": [row["r"] for row in rows],
                }
        self.snapshots_dir.mkdir(parents=True, exist_ok=True)
        path = self.snapshots_dir / f"{_now_stamp()}-{label}.json"
        path.write_text(json.dumps(snap, ensure_ascii=False, default=str))
        return path

    # ------------------------------------------------------------------
    # Diff + restore
    # ------------------------------------------------------------------
    def _current_rows(self, table: str, scope_cols: Sequence[str], owner_scope: dict[str, Any]):
        qualified = _qualify(self.schema, table)
        where, params = self._scope_where(scope_cols, owner_scope)
        rows = self.adapter.fetch(
            f"SELECT to_jsonb(t.*) AS r FROM {qualified} t WHERE {where}", params
        )
        return [row["r"] for row in rows]

    @staticmethod
    def _pk_tuple(row: dict[str, Any], pk: Sequence[str]) -> str:
        if pk:
            return json.dumps([row.get(col) for col in pk], sort_keys=True, default=str)
        return json.dumps(row, sort_keys=True, default=str)

    def diff_against(
        self,
        snapshot: dict[str, Any],
        declared_tables: Sequence[str] | None = None,
    ) -> dict[str, Any]:
        """Compare current DB state to a snapshot. Returns per-table
        inserted/updated/deleted rows plus sentinel violations. When
        ``declared_tables`` is given (the case's verifyEmptyTables), changed
        tables outside that declaration are flagged as undeclared writes —
        the declaration is audited, not trusted."""
        owner_scope = snapshot["owner_scope"]
        report: dict[str, Any] = {"tables": {}, "sentinel_violations": [], "unexpected_tables": []}

        current_tables = {e["table"]: e for e in self.discover_scoped_tables(owner_scope)}
        for table in current_tables:
            if table not in snapshot["tables"]:
                report["unexpected_tables"].append(table)

        for table, entry in snapshot["tables"].items():
            scope_cols = entry["scope_columns"]
            if entry["mode"] == "sentinel":
                qualified = _qualify(self.schema, table)
                where, params = self._scope_where(scope_cols, owner_scope)
                count = self.adapter.fetch(
                    f"SELECT count(*) AS n FROM {qualified} WHERE {where}", params
                )[0]["n"]
                checksum = self.adapter.fetch(
                    f"SELECT md5(string_agg(md5(to_jsonb(t.*)::text), '' ORDER BY md5(to_jsonb(t.*)::text))) AS c "
                    f"FROM {qualified} t WHERE {where}",
                    params,
                )[0]["c"]
                if count != entry["count"] or checksum != entry["checksum"]:
                    report["sentinel_violations"].append(
                        {"table": table, "expected": {"count": entry["count"]}, "actual": {"count": count}}
                    )
                continue

            pk = entry.get("primary_key") or []
            before = {self._pk_tuple(r, pk): r for r in entry["rows"]}
            after = {self._pk_tuple(r, pk): r for r in self._current_rows(table, scope_cols, owner_scope)}
            inserted = [after[k] for k in after.keys() - before.keys()]
            deleted = [before[k] for k in before.keys() - after.keys()]
            updated = [
                {"before": before[k], "after": after[k]}
                for k in before.keys() & after.keys()
                if json.dumps(before[k], sort_keys=True, default=str)
                != json.dumps(after[k], sort_keys=True, default=str)
            ]
            if inserted or deleted or updated:
                report["tables"][table] = {
                    "primary_key": pk,
                    "inserted": inserted,
                    "updated": updated,
                    "deleted": deleted,
                }

        # Tables that appeared after the snapshot: everything scoped in them is "inserted".
        for table in report["unexpected_tables"]:
            entry = current_tables[table]
            rows = self._current_rows(table, entry["scope_columns"], owner_scope)
            if rows:
                report["tables"][table] = {
                    "primary_key": self._primary_key(table),
                    "inserted": rows,
                    "updated": [],
                    "deleted": [],
                }

        if declared_tables is not None:
            declared_names = {t.split(".")[-1] for t in declared_tables}
            report["undeclared_writes"] = sorted(
                t for t in report["tables"] if t not in declared_names
            )
        return report

    def _delete_row(self, table: str, pk: Sequence[str], row: dict[str, Any]) -> None:
        qualified = _qualify(self.schema, table)
        if pk:
            cols = ", ".join(f'"{c}"' for c in pk)
            self.adapter.execute(
                f"DELETE FROM {qualified} t WHERE ({cols}) = "
                f"(SELECT {cols} FROM jsonb_populate_record(NULL::{qualified}, $1::jsonb))",
                [json.dumps(row, default=str)],
            )
        else:
            self.adapter.execute(
                f"DELETE FROM {qualified} t WHERE to_jsonb(t.*) = $1::jsonb",
                [json.dumps(row, default=str)],
            )

    def _insert_row(self, table: str, row: dict[str, Any]) -> None:
        qualified = _qualify(self.schema, table)
        self.adapter.execute(
            f"INSERT INTO {qualified} SELECT * FROM jsonb_populate_record(NULL::{qualified}, $1::jsonb)",
            [json.dumps(row, default=str)],
        )

    def _update_row(self, table: str, pk: Sequence[str], before: dict[str, Any]) -> None:
        qualified = _qualify(self.schema, table)
        non_pk_cols = [c for c in before.keys() if c not in pk]
        if not pk or not non_pk_cols:
            # Without a PK the only alternative would be delete+insert, which
            # is unsafe under ON DELETE CASCADE — refuse loudly instead.
            raise DfRunnerError(
                f"Cannot restore an updated row in {table} without a primary key."
            )
        set_cols = ", ".join(f'"{c}"' for c in non_pk_cols)
        pk_cols = ", ".join(f'"{c}"' for c in pk)
        self.adapter.execute(
            f"UPDATE {qualified} t SET ({set_cols}) = "
            f"(SELECT {set_cols} FROM jsonb_populate_record(NULL::{qualified}, $1::jsonb)) "
            f"WHERE ({pk_cols}) = (SELECT {pk_cols} FROM jsonb_populate_record(NULL::{qualified}, $1::jsonb))",
            [json.dumps(before, default=str)],
        )

    def restore(
        self,
        snapshot_path: Path,
        keep_scene: bool = False,
        scene_dump_dir: Path | None = None,
        declared_tables: Sequence[str] | None = None,
    ) -> dict[str, Any]:
        """Restore the DB to a snapshot. Returns the diff report that was
        applied. If ``keep_scene`` is set, dumps the scene (if a dump dir is
        given) and leaves the DB untouched — the snapshot stays pending so a
        later reconcile can settle it."""
        self.guard_write_policy()
        snapshot = json.loads(Path(snapshot_path).read_text())
        report = self.diff_against(snapshot, declared_tables=declared_tables)

        if scene_dump_dir is not None and (report["tables"] or report["sentinel_violations"]):
            scene_dump_dir.mkdir(parents=True, exist_ok=True)
            (scene_dump_dir / "scene.json").write_text(
                json.dumps(report, ensure_ascii=False, default=str, indent=2)
            )

        if keep_scene:
            return report

        if report["sentinel_violations"]:
            raise SentinelViolation(
                "Sentinel (read-only, big) tables changed and cannot be auto-restored: "
                + json.dumps(report["sentinel_violations"], default=str)
            )

        changed = report["tables"]
        # Touch-triggers (e.g. "SET updated_at := now() ON UPDATE") would make
        # an exact restore unreachable: every write-back bumps the column
        # again. Disable user triggers for this session during the write-back
        # (standard ETL practice); FK ordering is preserved by our own
        # sequencing, and the residual re-diff below still proves convergence.
        replica_mode = False
        try:
            self.adapter.execute("SET session_replication_role = replica")
            replica_mode = True
        except Exception:
            pass  # insufficient privilege: proceed; convergence check decides
        try:
            # 1) delete inserted rows, children first
            for table in self.order_children_first(changed.keys()):
                info = changed[table]
                for row in info["inserted"]:
                    self._delete_row(table, info["primary_key"], row)
            # 2) restore updated rows (order irrelevant: keys unchanged)
            for table, info in changed.items():
                for pair in info["updated"]:
                    self._update_row(table, info["primary_key"], pair["before"])
            # 3) re-insert deleted rows, parents first
            for table in reversed(self.order_children_first(changed.keys())):
                info = changed[table]
                for row in info["deleted"]:
                    self._insert_row(table, row)
        finally:
            if replica_mode:
                self.adapter.execute("SET session_replication_role = origin")

        residual = self.diff_against(snapshot)
        if residual["tables"] or residual["sentinel_violations"]:
            raise DfRunnerError(
                "Restore did not converge; residual diff remains: "
                + json.dumps(
                    {t: {k: len(v) for k, v in info.items() if isinstance(v, list)}
                     for t, info in residual["tables"].items()},
                    default=str,
                )
            )

        snapshot["reconciled"] = True
        Path(snapshot_path).write_text(json.dumps(snapshot, ensure_ascii=False, default=str))
        return report

    def reconcile_pending(self) -> list[Path]:
        """Settle every unreconciled snapshot from earlier crashed/kept runs.
        Newest first so nested snapshots unwind in the right order."""
        settled = []
        if not self.snapshots_dir.is_dir():
            return settled
        self.guard_write_policy()
        for path in sorted(self.snapshots_dir.glob("*.json"), reverse=True):
            snapshot = json.loads(path.read_text())
            if snapshot.get("reconciled"):
                continue
            if snapshot.get("environment") != self.adapter.current_env():
                raise DfRunnerError(
                    f"Pending snapshot {path.name} was taken in environment "
                    f"'{snapshot.get('environment')}' but current environment is "
                    f"'{self.adapter.current_env()}'. Resolve manually."
                )
            try:
                self.restore(path)
            except SentinelViolation as exc:
                raise SentinelViolation(
                    f"{exc}\nPending snapshot {path.name} cannot be auto-restored. "
                    "After resolving the sentinel table manually, settle the "
                    f"snapshot explicitly: python df_runner.py settle {path}"
                ) from exc
            settled.append(path)
        return settled

    def settle(self, snapshot_path: Path) -> None:
        """Explicit human escape hatch: mark a pending snapshot reconciled
        WITHOUT restoring. Use only after manually resolving a state (e.g. a
        sentinel violation) that the runner refuses to touch."""
        snapshot = json.loads(Path(snapshot_path).read_text())
        snapshot["reconciled"] = True
        snapshot["settled_manually_at"] = _now_stamp()
        Path(snapshot_path).write_text(json.dumps(snapshot, ensure_ascii=False, default=str))

    # ------------------------------------------------------------------
    # Start state
    # ------------------------------------------------------------------
    def verify_empty(self, tables: Sequence[str], owner_scope: dict[str, Any]) -> None:
        dirty = {}
        for qualified in tables:
            schema, table = _split_qualified(qualified, self.schema)
            columns = {
                row["column_name"]
                for row in self.adapter.fetch(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = $1 AND table_name = $2",
                    [schema, table],
                )
            }
            scope_cols = [c for c in owner_scope if c in columns]
            if not scope_cols:
                raise DfRunnerError(f"{qualified} has no owner column; cannot verify scope")
            where, params = self._scope_where(scope_cols, owner_scope)
            count = self.adapter.fetch(
                f"SELECT count(*) AS n FROM {schema}.{table} WHERE {where}", params
            )[0]["n"]
            if count:
                dirty[qualified] = count
        if dirty:
            raise StartStateDirty(
                "Start state is not clean (previous case's reset failed, or an "
                f"external writer touched the scope): {dirty}"
            )

    def clean(self, tables: Sequence[str], owner_scope: dict[str, Any]) -> dict[str, int]:
        """Owner-scoped delete, children first. Session-level use only —
        cases must not clean their own start (they verify instead)."""
        self.guard_write_policy()
        deleted: dict[str, int] = {}
        for qualified in self.order_children_first(tables):
            schema, table = _split_qualified(qualified, self.schema)
            columns = {
                row["column_name"]
                for row in self.adapter.fetch(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = $1 AND table_name = $2",
                    [schema, table],
                )
            }
            scope_cols = [c for c in owner_scope if c in columns]
            if not scope_cols:
                raise DfRunnerError(f"{qualified} has no owner column; refusing to delete")
            where, params = self._scope_where(scope_cols, owner_scope)
            before = self.adapter.fetch(
                f"SELECT count(*) AS n FROM {schema}.{table} WHERE {where}", params
            )[0]["n"]
            self.adapter.execute(f"DELETE FROM {schema}.{table} WHERE {where}", params)
            deleted[qualified] = before
        return deleted

    # ------------------------------------------------------------------
    # Prep primitives
    # ------------------------------------------------------------------
    def run_process(
        self,
        command: Sequence[str],
        cwd: str | None = None,
        env: dict[str, str] | None = None,
        timeout: int = 1800,
        log_path: Path | None = None,
    ) -> str:
        """Run a real product entrypoint as a prep step. A non-zero exit is a
        PrepStepFailed (attribution: upstream broke, not the subject under test)."""
        import os

        full_env = dict(os.environ)
        if env:
            full_env.update(env)
        workdir = self.repo_root / cwd if cwd else self.repo_root
        result = subprocess.run(
            list(command),
            cwd=workdir,
            env=full_env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = result.stdout + ("\n--- stderr ---\n" + result.stderr if result.stderr else "")
        if log_path is not None:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            log_path.write_text(output)
        if result.returncode != 0:
            raise PrepStepFailed(
                f"Prep process {' '.join(command)} exited {result.returncode}. "
                f"Last output:\n{output[-4000:]}"
            )
        return output

    def _jsonb_columns(self, schema: str, table: str) -> set[str]:
        rows = self.adapter.fetch(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = $1 AND table_name = $2 AND data_type IN ('json', 'jsonb')",
            [schema, table],
        )
        return {row["column_name"] for row in rows}

    def _column_default_json(self, schema: str, table: str, column: str) -> Any:
        """Parse a json/jsonb column's DDL default (e.g. ``'{}'::jsonb``)
        into a Python value; None when there is no parseable default."""
        rows = self.adapter.fetch(
            "SELECT column_default FROM information_schema.columns "
            "WHERE table_schema = $1 AND table_name = $2 AND column_name = $3",
            [schema, table, column],
        )
        default = rows[0]["column_default"] if rows else None
        if not default:
            return None
        text = str(default).split("::")[0].strip()
        if text.startswith("'") and text.endswith("'"):
            text = text[1:-1]
        try:
            return json.loads(text)
        except (ValueError, TypeError):
            return None

    def _validate_jsonb(self, table: str, column: str, value: Any) -> None:
        """Validate a json/jsonb value against the project's JSONB schema
        SSOT. Convention: schema files are named ``<table>.<column>.json``
        under ``ssot-config.json.db.ssot.jsonbPath``. A column without a
        schema file has no contract to violate and is not validated."""
        ssot = (self.db_config.get("ssot") or {}).get("jsonbPath")
        if not ssot:
            raise SeedValidationError(
                "ssot-config.json.db.ssot.jsonbPath is not configured; cannot "
                f"seed json column {table}.{column} without the JSONB schema SSOT."
            )
        ssot_dir = self.repo_root / ssot
        if not ssot_dir.is_dir():
            raise SeedValidationError(f"JSONB schema SSOT directory does not exist: {ssot_dir}")
        schema_file = ssot_dir / f"{table}.{column}.json"
        if not schema_file.is_file():
            return
        try:
            import jsonschema
        except ImportError as exc:
            raise SeedValidationError(
                f"A JSONB schema exists for {table}.{column} but the 'jsonschema' "
                "package is not installed; install it to seed this table."
            ) from exc
        try:
            jsonschema.validate(value, json.loads(schema_file.read_text()))
        except jsonschema.ValidationError as exc:
            raise SeedValidationError(
                f"Seed value for {table}.{column} violates {schema_file.name}: {exc.message}"
            ) from exc

    def seed(self, data: dict[str, list[dict[str, Any]]] | Path, owner_scope: dict[str, Any]) -> int:
        """Insert crafted rows. ``data`` maps table name -> row dicts (or a
        JSON file with that shape plus optional metadata keys starting with
        '_'). Every row must carry the owner columns with exactly the owner
        values; JSONB columns are validated against the project's JSONB
        schema SSOT before writing."""
        if isinstance(data, (str, Path)):
            data = json.loads(Path(data).read_text())
        self.guard_write_policy()
        tables = {k: v for k, v in data.items() if not k.startswith("_")}
        inserted = 0
        for qualified in reversed(self.order_children_first(tables.keys())):  # parents first
            rows = tables[qualified]
            schema, table = _split_qualified(qualified, self.schema)
            table_columns = self._table_columns(schema, table)
            if not table_columns:
                raise SeedValidationError(f"Seed target table does not exist: {qualified}")
            if not any(col in table_columns for col in owner_scope):
                raise SeedValidationError(
                    f"Seed target {qualified} carries no owner column from "
                    f"{sorted(owner_scope)}: rows there would be invisible to the "
                    "owner-scoped snapshot and never restored. Refusing to seed."
                )
            jsonb_cols = self._jsonb_columns(schema, table)
            for row in rows:
                for col, value in owner_scope.items():
                    if col in row and row[col] != value:
                        raise SeedValidationError(
                            f"Seed row for {qualified} sets {col}={row[col]!r}, "
                            f"outside the owner scope {owner_scope}"
                        )
                missing_scope = [
                    col for col in owner_scope
                    if col not in row and col in table_columns
                ]
                if missing_scope:
                    raise SeedValidationError(
                        f"Seed row for {qualified} is missing owner column(s) {missing_scope}"
                    )
                for col in jsonb_cols & row.keys():
                    if row[col] is None:
                        continue
                    # A value equal to the column's DDL default is by
                    # definition a legal state (the DB produces it on every
                    # defaulted insert); skip schema validation for it. This
                    # also sidesteps product schemas that reject their own
                    # column default — a product inconsistency to surface in
                    # review, not a seed blocker.
                    if row[col] == self._column_default_json(schema, table, col):
                        continue
                    self._validate_jsonb(table, col, row[col])
                self._insert_row(f"{schema}.{table}", row)
                inserted += 1
        return inserted

    def _table_columns(self, schema: str, table: str) -> set[str]:
        rows = self.adapter.fetch(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = $1 AND table_name = $2",
            [schema, table],
        )
        return {row["column_name"] for row in rows}

    # ------------------------------------------------------------------
    # Shared preconditions (verify-only, with input fingerprint)
    # ------------------------------------------------------------------
    def _fingerprint_value(self, query: dict[str, Any]) -> Any:
        schema, table = _split_qualified(query["table"], self.schema)
        where_clauses, params = [], []
        for index, (col, value) in enumerate(sorted((query.get("where") or {}).items()), start=1):
            where_clauses.append(f'"{col}" = ${index}')
            params.append(value)
        where = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        kind = query.get("kind", "count")
        if kind == "count":
            sql = f"SELECT count(*) AS v FROM {schema}.{table}{where}"
        elif kind.startswith("max:"):
            sql = f'SELECT max("{kind[4:]}")::text AS v FROM {schema}.{table}{where}'
        elif kind == "checksum":
            sql = (
                f"SELECT md5(string_agg(md5(to_jsonb(t.*)::text), '' "
                f"ORDER BY md5(to_jsonb(t.*)::text))) AS v FROM {schema}.{table} t{where}"
            )
        else:
            raise DfRunnerError(f"Unknown fingerprint kind: {kind}")
        return self.adapter.fetch(sql, params)[0]["v"]

    def verify_preconditions(self, shared_df_dir: Path) -> None:
        """Verify a shared precondition directory: existence checks plus
        fingerprint comparison. A mismatch is InputDrift — a distinct failure
        class, not a product bug."""
        manifest = json.loads((shared_df_dir / "manifest.json").read_text())
        for check in manifest.get("checks", []):
            schema, table = _split_qualified(check["table"], self.schema)
            where_clauses, params = [], []
            for index, (col, value) in enumerate(sorted((check.get("where") or {}).items()), start=1):
                where_clauses.append(f'"{col}" = ${index}')
                params.append(value)
            where = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
            count = self.adapter.fetch(
                f"SELECT count(*) AS n FROM {schema}.{table}{where}", params
            )[0]["n"]
            if count < check.get("minCount", 1):
                raise InputDrift(
                    f"Precondition failed: {check['table']} has {count} rows, "
                    f"expected at least {check.get('minCount', 1)}"
                )
        baseline_file = shared_df_dir / "data.json"
        queries = (manifest.get("fingerprint") or {}).get("queries", [])
        if queries:
            if not baseline_file.is_file():
                raise InputDrift(
                    f"No fingerprint baseline at {baseline_file}; capture one with "
                    "capture_baseline() before running."
                )
            baseline = json.loads(baseline_file.read_text())
            for query in queries:
                actual = self._fingerprint_value(query)
                expected = baseline.get(query["name"])
                if str(actual) != str(expected):
                    raise InputDrift(
                        f"Input drift on fingerprint '{query['name']}': "
                        f"baseline {expected!r}, actual {actual!r}. Re-baseline "
                        "deliberately if the input change is intentional."
                    )

    def capture_baseline(self, shared_df_dir: Path) -> Path:
        manifest = json.loads((shared_df_dir / "manifest.json").read_text())
        baseline = {
            query["name"]: self._fingerprint_value(query)
            for query in (manifest.get("fingerprint") or {}).get("queries", [])
        }
        baseline["_captured_at"] = _now_stamp()
        path = shared_df_dir / "data.json"
        path.write_text(json.dumps(baseline, ensure_ascii=False, default=str, indent=2))
        return path

    # ------------------------------------------------------------------
    # Manifest-driven case lifecycle
    # ------------------------------------------------------------------
    def case_setup(self, case_dir: Path) -> Path:
        """verify start -> snapshot -> prep steps. Returns the snapshot path
        the teardown must restore."""
        manifest = json.loads((case_dir / "df" / "manifest.json").read_text())
        owner_scope = manifest["ownerScope"]
        self.guard_environment(manifest.get("allowResetEnvironments", []))
        precondition = manifest.get("preconditions")
        if precondition:
            self.verify_preconditions(self.repo_root / precondition)
        self.verify_empty(manifest.get("verifyEmptyTables", []), owner_scope)
        snapshot_path = self.snapshot(owner_scope, label=case_dir.name)
        artifacts = case_dir / "run-artifacts" / _now_stamp()
        try:
            for index, step in enumerate(manifest.get("prepSteps", [])):
                if step["type"] == "process":
                    self.run_process(
                        step["command"],
                        cwd=step.get("cwd"),
                        env=step.get("env"),
                        timeout=step.get("timeout", 1800),
                        log_path=artifacts / f"prep-{index}-process.log",
                    )
                elif step["type"] == "seed":
                    if not step.get("emulates"):
                        raise SeedValidationError(
                            "Seed prep steps must declare 'emulates': which real "
                            "process this crafted data impersonates."
                        )
                    self.seed(case_dir / step["data"], owner_scope)
                else:
                    raise DfRunnerError(f"Unknown prep step type: {step['type']}")
        except Exception:
            # Prep failed: settle the snapshot immediately so no residue leaks.
            self.restore(snapshot_path)
            raise
        return snapshot_path

    def case_teardown(
        self,
        case_dir: Path,
        snapshot_path: Path,
        failed: bool = False,
        keep_scene: bool = False,
    ) -> dict[str, Any]:
        """Restore to the case snapshot. On failure the scene is dumped to the
        case's run-artifacts first; with ``keep_scene`` the DB is left as-is
        (snapshot stays pending for a later reconcile). The manifest's
        verifyEmptyTables are passed as the declared output tables so the
        diff report flags undeclared writes."""
        manifest = json.loads((case_dir / "df" / "manifest.json").read_text())
        dump_dir = (case_dir / "run-artifacts" / f"{_now_stamp()}-scene") if failed else None
        declared = [
            *manifest.get("verifyEmptyTables", []),
            *manifest.get("additionalOutputTables", []),
        ]
        return self.restore(
            snapshot_path,
            keep_scene=keep_scene,
            scene_dump_dir=dump_dir,
            declared_tables=declared,
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="AutoQA data-fixture runner CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("reconcile", help="settle all pending snapshots")
    snap = sub.add_parser("snapshot", help="take an owner-scoped snapshot")
    snap.add_argument("--scope", required=True, help='JSON, e.g. {"user_id": 1, "tenant_id": 2}')
    snap.add_argument("--label", required=True)
    restore = sub.add_parser("restore", help="restore a snapshot file")
    restore.add_argument("path")
    verify = sub.add_parser("verify-empty", help="assert owner-scoped tables are empty")
    verify.add_argument("--scope", required=True)
    verify.add_argument("--tables", required=True, help="comma-separated")
    baseline = sub.add_parser("baseline", help="capture a shared-df fingerprint baseline")
    baseline.add_argument("shared_df_dir")
    settle = sub.add_parser(
        "settle",
        help="mark a pending snapshot reconciled WITHOUT restoring (manual escape hatch)",
    )
    settle.add_argument("path")
    args = parser.parse_args(argv)

    runner = DfRunner()
    if args.cmd == "reconcile":
        settled = runner.reconcile_pending()
        print(json.dumps({"settled": [p.name for p in settled]}))
    elif args.cmd == "snapshot":
        path = runner.snapshot(json.loads(args.scope), args.label)
        print(str(path))
    elif args.cmd == "restore":
        report = runner.restore(Path(args.path))
        print(json.dumps({t: {k: len(v) for k, v in i.items() if isinstance(v, list)}
                          for t, i in report["tables"].items()}, default=str))
    elif args.cmd == "verify-empty":
        runner.verify_empty(args.tables.split(","), json.loads(args.scope))
        print("clean")
    elif args.cmd == "baseline":
        print(str(runner.capture_baseline(Path(args.shared_df_dir))))
    elif args.cmd == "settle":
        runner.settle(Path(args.path))
        print("settled (no restore performed)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
