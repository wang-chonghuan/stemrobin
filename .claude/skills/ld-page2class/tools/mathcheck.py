"""公式校验：分隔符配对 + KaTeX 可解析性。

设计要点：校验用的引擎就是将来 HTML 渲染用的 KaTeX。cap1 通过 ⇒ 网页一定渲得出来。
只做「能不能渲染」的判定，不改写任何公式内容。
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
SKILL = TOOLS.parent

# $$...$$ 优先于 $...$
_SPAN = re.compile(r"\$\$(.+?)\$\$|\$([^$]+?)\$", re.S)


def find_math_spans(text: str) -> list[tuple[str, bool]]:
    """返回 [(tex, is_display)]。"""
    out = []
    for m in _SPAN.finditer(text):
        if m.group(1) is not None:
            out.append((m.group(1), True))
        else:
            out.append((m.group(2), False))
    return out


def check_delimiters(text: str) -> list[str]:
    """$ 与 $$ 是否配对；花括号是否平衡。"""
    errs = []
    stripped = _SPAN.sub("", text)
    if "$" in stripped:
        errs.append(f"存在未配对的 $（去掉合法数学区后仍残留 {stripped.count('$')} 个）")
    for tex, disp in find_math_spans(text):
        depth = 0
        i = 0
        while i < len(tex):
            if tex[i] == "\\":
                i += 2
                continue
            if tex[i] == "{":
                depth += 1
            elif tex[i] == "}":
                depth -= 1
                if depth < 0:
                    errs.append(f"花括号提前闭合: {tex[:40]!r}")
                    break
            i += 1
        if depth > 0:
            errs.append(f"花括号未闭合（缺 {depth} 个 }}）: {tex[:40]!r}")
    return errs


def katex_validate(items: list[dict]) -> list[dict]:
    """items: [{id, field, tex, display}] → [{id, field, ok, error?, warnings?}]"""
    if not items:
        return []
    script = TOOLS / "katex_check.js"
    if not (SKILL / "node_modules" / "katex").exists():
        return [{"fatal": "未安装 katex：在技能目录执行 npm install katex"}]
    proc = subprocess.run(
        ["node", str(script)],
        input=json.dumps(items, ensure_ascii=False),
        capture_output=True, text=True, cwd=str(SKILL),
    )
    if proc.returncode != 0:
        return [{"fatal": f"katex_check.js 失败: {proc.stderr.strip()[:200]}"}]
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return [{"fatal": f"katex_check.js 输出异常: {proc.stdout[:200]}"}]


def collect_and_check(blocks: list[dict], iter_texts) -> tuple[list[str], list[dict]]:
    """返回 (错误列表, KaTeX 警告列表)。"""
    errors: list[str] = []
    items: list[dict] = []
    for b in blocks:
        for field, text in iter_texts(b):
            for e in check_delimiters(text):
                errors.append(f"{b['id']}.{field}: {e}")
            for tex, disp in find_math_spans(text):
                items.append({"id": b["id"], "field": field,
                              "tex": tex, "display": disp})

    warns: list[dict] = []
    for r in katex_validate(items):
        if r.get("fatal"):
            errors.append(f"KaTeX 校验不可用: {r['fatal']}")
            continue
        if not r.get("ok"):
            errors.append(f"{r['id']}.{r['field']}: KaTeX 无法解析 — {r.get('error')}")
        for w in r.get("warnings") or []:
            warns.append({"block_id": r["id"], "field": r["field"], "warning": w})
    return errors, warns
