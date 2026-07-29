#!/usr/bin/env python3
"""ld-mathpdf 命令行工具。

cap1  prepare  → 渲染 + 版面分割 + 裁图（确定性，为视觉转写备料）
cap1  finalize → 规范化 + schema 校验 + 白名单（视觉转写之后）
cap2  window   → 汇集 N-1/N/N+1 的 cap1 事实，供缝合
cap2  check    → 校验 meta/stitch，机械阻断改字
cap3  consistency → 全书一致性统计与漂移检测
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import layout  # noqa: E402
import mathcheck  # noqa: E402
import normalize as nz  # noqa: E402

SKILL_DIR = Path(__file__).resolve().parent.parent
SCHEMAS = SKILL_DIR / "schemas"

TEXT_IMMUTABLE = ("text", "stem", "caption", "title")


def _load(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def _dump(p: Path, obj: dict) -> None:
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _sha_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _sha_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def _page_dir(root: Path, book: str, page: int) -> Path:
    return root / book / "pages" / f"{page:04d}"


def _stitch_dir(root: Path, book: str, page: int) -> Path:
    return root / book / "stitched" / f"{page:04d}"


def _validate(instance: dict, schema: dict) -> list[str]:
    import jsonschema
    v = jsonschema.Draft202012Validator(schema)
    return [f"{'/'.join(str(x) for x in e.path)}: {e.message}"
            for e in sorted(v.iter_errors(instance), key=lambda e: list(e.path))]


# ---------------- cap1 ----------------

def cmd_prepare(a) -> int:
    pdir = _page_dir(Path(a.root), a.book, a.page)
    blocks = layout.prepare(Path(a.pdf), a.book, a.page, pdir, dpi=a.dpi)
    profile_path = Path(a.profile)
    template = {
        "schema": "ld-mathpdf/page@1",
        "book_id": a.book,
        "page": a.page,
        "printed_page": None,
        "source": {"pdf_sha256": _sha_file(Path(a.pdf)), "pdf_page": a.page},
        "render": blocks["render"],
        "profile": {"id": _load(profile_path)["id"], "sha256": _sha_file(profile_path)},
        "blocks": [],
        "problems": [],
        "figures_cited": [],
        "flags": {"starts_mid_sentence": False, "ends_mid_sentence": False,
                  "illegible": [], "source_errors": [], "unknown_chars": []},
        "provenance": {"cap": "1", "normalized": False},
    }
    _dump(pdir / "page.template.json", template)
    figs = [c for c in blocks["candidates"] if c["kind"] == "figure"]
    print(f"[prepare] {a.book} p{a.page:04d} -> {pdir}")
    print(f"  页面 {blocks['render']['w']}x{blocks['render']['h']} @{a.dpi}dpi"
          f"  正文行高≈{blocks['text_line_height']}px")
    print(f"  候选条带 {len(blocks['candidates'])} 个，其中插图候选 {len(figs)} 个")
    for c in figs:
        print(f"    {c['id']} bbox={c['bbox']} 有框={c['has_frame']} "
              f"高/行高={c['height_ratio']} -> {c.get('file')}")
    return 0


def cmd_finalize(a) -> int:
    pdir = _page_dir(Path(a.root), a.book, a.page)
    page_json = pdir / "page.json"
    if not page_json.exists():
        print(f"ERROR: 缺少 {page_json}（cap1 视觉转写尚未产出）", file=sys.stderr)
        return 2

    doc = _load(page_json)
    blocks_meta = _load(pdir / "blocks.json")
    profile_path = Path(a.profile)
    profile = nz.load_profile(profile_path)

    # 机器可确定的字段一律以事实覆盖，不信任转写环节
    doc["schema"] = "ld-mathpdf/page@1"
    doc["book_id"] = a.book
    doc["page"] = a.page
    doc["render"] = blocks_meta["render"]
    doc["source"] = {"pdf_sha256": _sha_file(Path(a.pdf)), "pdf_page": a.page}
    doc["profile"] = {"id": profile["id"], "sha256": _sha_file(profile_path)}
    doc.setdefault("flags", {}).setdefault("illegible", [])
    doc["flags"].setdefault("source_errors", [])
    doc["provenance"] = {"cap": "1", "normalized": True,
                         **{k: v for k, v in doc.get("provenance", {}).items()
                            if k in ("agent", "note")}}

    # 规范化
    applied: list[dict] = []
    for b in doc.get("blocks", []):
        for field, text in list(nz.iter_block_texts(b)):
            new, changes = nz.normalize_text(text, profile)
            if b.get("type") == "toc_entry":
                new = nz.normalize_toc_leader(new, profile)
            if new != text:
                nz.set_block_text(b, field, new)
                applied.append({"block": b["id"], "field": field, "rules": changes})

    # 白名单
    unknown: list[dict] = []
    for b in doc.get("blocks", []):
        for _field, text in nz.iter_block_texts(b):
            for bad in nz.check_charset(text, profile):
                unknown.append({"char": bad["char"], "codepoint": bad["codepoint"],
                                "block_id": b["id"]})
    doc["flags"]["unknown_chars"] = unknown

    errors: list[str] = []
    w, h = doc["render"]["w"], doc["render"]["h"]
    ids = [b["id"] for b in doc.get("blocks", [])]
    if len(ids) != len(set(ids)):
        errors.append("block id 重复")
    if ids != sorted(ids):
        errors.append("block 未按阅读顺序排列（id 应递增）")
    for b in doc.get("blocks", []):
        x, y, bw, bh = b["bbox"]
        if x + bw > w or y + bh > h:
            errors.append(f"{b['id']}: bbox 越出页面 {b['bbox']} > {w}x{h}")
        if b.get("type") == "figure":
            f = pdir / b["file"]
            if not f.exists():
                errors.append(f"{b['id']}: 插图文件不存在 {b['file']}")
        for it in b.get("items") or []:
            script = nz.enum_key_script(it["key"])
            if (profile.get("enum_marker_script") == "cyrillic"
                    and script not in ("cyrillic", "numeric")):
                errors.append(
                    f"{b['id']}: 小问标号 {it['key']!r} 是 {script}，"
                    f"应为西里尔（字形相同，须核码点）")
    if unknown:
        errors.append(f"白名单外字符 {len(unknown)} 处: "
                      + ", ".join(f"{u['char']}({u['codepoint']})" for u in unknown[:8]))

    # 公式：分隔符配对 + KaTeX 可解析。校验引擎 = 将来 HTML 渲染引擎。
    math_errors, math_warns = mathcheck.collect_and_check(
        doc.get("blocks", []), nz.iter_block_texts)
    errors += math_errors

    errors += _validate(doc, _load(SCHEMAS / "page.schema.json"))

    _dump(page_json, doc)
    n_formulas = sum(len(mathcheck.find_math_spans(t))
                     for b in doc.get("blocks", [])
                     for _f, t in nz.iter_block_texts(b))
    report = {"page": a.page, "normalizations": applied,
              "unknown_chars": unknown, "formulas": n_formulas,
              "katex_warnings": math_warns, "errors": errors}
    _dump(pdir / "finalize.report.json", report)

    print(f"[finalize] {a.book} p{a.page:04d}: {len(doc.get('blocks', []))} blocks, "
          f"{n_formulas} 条公式, 规范化 {len(applied)} 处")
    if math_warns:
        print(f"  ⚠ KaTeX 警告 {len(math_warns)} 条:")
        for w in math_warns[:6]:
            print(f"    - {w['block_id']}.{w['field']}: {w['warning']}")
    for ap in applied:
        rules = ",".join(c["rule"] for c in ap["rules"])
        print(f"    {ap['block']}.{ap['field']}: {rules}")
    if errors:
        print(f"  ✗ 失败 {len(errors)} 项:")
        for e in errors:
            print(f"    - {e}")
        return 1
    print("  ✓ 通过 schema + 白名单 + 几何校验")
    return 0


# ---------------- cap2 ----------------

def cmd_window(a) -> int:
    root = Path(a.root)
    pages = [p for p in (a.page - 1, a.page, a.page + 1) if p >= 1]
    bundle = {"book_id": a.book, "target_page": a.page, "window": [], "missing": []}
    for p in pages:
        f = _page_dir(root, a.book, p) / "page.json"
        if f.exists():
            bundle["window"].append({"page": p, "path": str(f), "doc": _load(f)})
        else:
            bundle["missing"].append(p)
    out = _stitch_dir(root, a.book, a.page)
    out.mkdir(parents=True, exist_ok=True)
    _dump(out / "window.json", bundle)
    print(f"[window] {a.book} p{a.page:04d}: 窗口 "
          f"{[x['page'] for x in bundle['window']]}，缺 {bundle['missing']}")
    print(f"  -> {out / 'window.json'}")
    return 0


def _text_map(doc: dict) -> dict[str, dict[str, str]]:
    return {b["id"]: {f: t for f, t in nz.iter_block_texts(b)}
            for b in doc.get("blocks", [])}


def cmd_stitch_check(a) -> int:
    root = Path(a.root)
    pdir = _page_dir(root, a.book, a.page)
    sdir = _stitch_dir(root, a.book, a.page)
    meta_p, stitch_p = sdir / "meta.json", sdir / "stitch.json"
    for f in (meta_p, stitch_p):
        if not f.exists():
            print(f"ERROR: 缺少 {f}", file=sys.stderr)
            return 2

    cap1 = _load(pdir / "page.json")
    meta = _load(meta_p)
    stitch = _load(stitch_p)
    errors: list[str] = []

    errors += [f"stitch.json {e}" for e in
               _validate(stitch, _load(SCHEMAS / "stitch.schema.json"))]

    meta_schema = copy.deepcopy(_load(SCHEMAS / "page.schema.json"))
    meta_schema["$id"] = "ld-mathpdf/meta@1"
    meta_schema["properties"]["schema"] = {"const": "ld-mathpdf/meta@1"}
    meta_schema["properties"]["provenance"]["properties"]["cap"] = {"const": "2"}
    meta_schema["properties"]["stitch_ref"] = {"type": "string"}
    errors += [f"meta.json {e}" for e in _validate(meta, meta_schema)]

    if stitch.get("based_on", {}).get("page_json_sha256") != _sha_file(pdir / "page.json"):
        errors.append("stitch.based_on 与当前 page.json 哈希不符（cap1 产物已变，须重跑 cap2）")

    # ---- 核心：机械阻断改字 ----
    a_map, b_map = _text_map(cap1), _text_map(meta)
    missing = set(a_map) - set(b_map)
    invented = set(b_map) - set(a_map)
    if missing:
        errors.append(f"cap2 丢失了 block：{sorted(missing)}（禁止删）")
    if invented:
        errors.append(f"cap2 凭空新增 block：{sorted(invented)}（禁止增）")
    for bid in sorted(set(a_map) & set(b_map)):
        for field in TEXT_IMMUTABLE:
            old, new = a_map[bid].get(field), b_map[bid].get(field)
            if old is not None and new != old:
                errors.append(f"{bid}.{field}: cap2 改写了文本（禁止）"
                              f"\n        cap1: {old[:60]!r}\n        cap2: {new[:60]!r}")
        old_items = {k: v for k, v in a_map[bid].items() if k.startswith("items[")}
        for k, old in old_items.items():
            if b_map[bid].get(k) != old:
                errors.append(f"{bid}.{k}: cap2 改写了小问文本（禁止）")

    allowed_ops = {"merge_across_page", "reclassify", "attach_figure_ref", "mark_continuation"}
    for ch in stitch.get("changes", []):
        if ch["op"] not in allowed_ops:
            errors.append(f"非法操作 {ch['op']}")
        if ch["block_id"] not in a_map:
            errors.append(f"changes 引用了不存在的 block {ch['block_id']}")

    changed_ids = {c["block_id"] for c in stitch.get("changes", [])}
    for bid in set(a_map) & set(b_map):
        cap1_b = next(b for b in cap1["blocks"] if b["id"] == bid)
        meta_b = next(b for b in meta["blocks"] if b["id"] == bid)
        if cap1_b.get("type") != meta_b.get("type") and bid not in changed_ids:
            errors.append(f"{bid}: 类型被改却未在 stitch.changes 记录（须自证）")

    report = {"page": a.page, "errors": errors,
              "changes": len(stitch.get("changes", [])),
              "suggestions": len(stitch.get("suggestions", []))}
    _dump(sdir / "check.report.json", report)

    print(f"[cap2 check] {a.book} p{a.page:04d}: "
          f"{report['changes']} 处改动, {report['suggestions']} 条建议")
    if errors:
        print(f"  ✗ 失败 {len(errors)} 项:")
        for e in errors:
            print(f"    - {e}")
        return 1
    print("  ✓ 通过：无增删、无改字、改动已自证")
    return 0


# ---------------- cap3 ----------------

def cmd_consistency(a) -> int:
    root = Path(a.root)
    profile = nz.load_profile(Path(a.profile))
    pages_dir = root / a.book / "pages"
    if not pages_dir.exists():
        print(f"ERROR: 无 {pages_dir}", file=sys.stderr)
        return 2

    totals: dict[str, int] = {}
    per_page: dict[int, dict[str, int]] = {}
    charset_hits: list[dict] = []
    enum_hits: list[dict] = []

    page_files = sorted(pages_dir.glob("*/page.json"))
    for pf in page_files:
        doc = _load(pf)
        pg = doc["page"]
        sig: dict[str, int] = {}
        for b in doc.get("blocks", []):
            for _field, text in nz.iter_block_texts(b):
                for k, v in nz.variant_signals(text).items():
                    sig[k] = sig.get(k, 0) + v
                for bad in nz.check_charset(text, profile):
                    charset_hits.append({"page": pg, "block": b["id"], **bad})
            for it in b.get("items") or []:
                script = nz.enum_key_script(it["key"])
                if script != profile.get("enum_marker_script") and script != "numeric":
                    enum_hits.append({"page": pg, "block": b["id"],
                                      "key": it["key"], "script": script})
        per_page[pg] = sig
        for k, v in sig.items():
            totals[k] = totals.get(k, 0) + v

    # 同一轴上出现多种写法 → 漂移
    axes: dict[str, dict[str, int]] = {}
    for k, v in totals.items():
        axis, variant = k.rsplit(".", 1)
        axes.setdefault(axis, {})[variant] = v

    drifts = []
    for axis, variants in sorted(axes.items()):
        present = {k: v for k, v in variants.items() if v > 0}
        if len(present) > 1:
            total = sum(present.values())
            minority = sorted(present.items(), key=lambda kv: kv[1])[:-1]
            offenders = []
            for var, _cnt in minority:
                key = f"{axis}.{var}"
                offenders += [p for p, s in sorted(per_page.items()) if s.get(key)]
            drifts.append({"axis": axis, "variants": present,
                           "minority": [m[0] for m in minority],
                           "minority_ratio": round(
                               sum(c for _, c in minority) / total, 4),
                           "pages": sorted(set(offenders))})

    # profile 符合性：全书写法一致但整体违反 profile 时，漂移检测看不见，须单独查。
    violations = []
    if profile.get("fraction_macro") == "\\frac" and totals.get("fraction.dfrac"):
        violations.append({"rule": "fraction_macro", "expected": "\\frac",
                           "found": "\\dfrac", "count": totals["fraction.dfrac"],
                           "pages": [p for p, s in sorted(per_page.items())
                                     if s.get("fraction.dfrac")]})
    if profile.get("script_style") == "latex":
        n = totals.get("script.unicode_sup", 0) + totals.get("script.unicode_sub", 0)
        if n:
            violations.append({"rule": "script_style", "expected": "latex",
                               "found": "unicode 上下标", "count": n,
                               "pages": [p for p, s in sorted(per_page.items())
                                         if s.get("script.unicode_sup")
                                         or s.get("script.unicode_sub")]})
    if profile.get("math_minus") == "ascii" and totals.get("minus.u2212"):
        violations.append({"rule": "math_minus", "expected": "ascii '-'",
                           "found": "U+2212", "count": totals["minus.u2212"],
                           "pages": [p for p, s in sorted(per_page.items())
                                     if s.get("minus.u2212")]})

    result = {
        "book_id": a.book,
        "pages_scanned": len(page_files),
        "profile": profile["id"],
        "profile_violations": violations,
        "drifts": drifts,
        "charset_violations": charset_hits,
        "enum_marker_violations": enum_hits,
        "totals": totals,
    }
    out = root / a.book / "consistency.json"
    _dump(out, result)

    print(f"[cap3] {a.book}: 扫描 {len(page_files)} 页")
    if violations:
        print(f"  ✗ 违反 profile {len(violations)} 项：")
        for v in violations:
            print(f"    - {v['rule']}: 应为 {v['expected']}，实为 {v['found']} "
                  f"×{v['count']}，页 {v['pages']}")
    if drifts:
        print(f"  ⚠ 检出 {len(drifts)} 条写法漂移：")
        for d in drifts:
            print(f"    - {d['axis']}: {d['variants']}  少数派={d['minority']} "
                  f"出现在页 {d['pages']}")
    else:
        print("  ✓ 无写法漂移")
    if charset_hits:
        print(f"  ✗ 白名单外字符 {len(charset_hits)} 处")
        for c in charset_hits[:10]:
            print(f"    - p{c['page']} {c['block']}: {c['char']!r} {c['codepoint']} {c['name']}")
    if enum_hits:
        print(f"  ✗ 小问标号字符集错误 {len(enum_hits)} 处")
        for e in enum_hits[:10]:
            print(f"    - p{e['page']} {e['block']}: {e['key']!r} -> {e['script']}")
    print(f"  -> {out}")
    return 1 if (violations or drifts or charset_hits or enum_hits) else 0


# ---------------- cap4 ----------------

def cmd_vectorize(a) -> int:
    import vectorize as vec
    root = Path(a.root)
    if a.page:
        dirs = [_page_dir(root, a.book, a.page)]
    else:
        dirs = sorted((root / a.book / "pages").glob("*"))
    total = failed = 0
    for pdir in dirs:
        if not (pdir / "figures").exists():
            continue
        rep = vec.vectorize_page(pdir, turdsize=a.turdsize, alphamax=a.alphamax)
        if not rep["results"]:
            continue
        print(f"[cap4] {pdir.name}: {rep['figures']} 幅")
        for r in rep["results"]:
            total += 1
            mark = "✓" if r["ok"] else "✗"
            if not r["ok"]:
                failed += 1
            if "error" in r:
                print(f"  ✗ {Path(r['svg']).name}: {r['error']}")
                continue
            kb_png, kb_svg = r["png_bytes"] / 1024, r["svg_bytes"] / 1024
            print(f"  {mark} {Path(r['svg']).name}  {r['size'][0]}x{r['size'][1]}  "
                  f"{r['curves']} 条路径  PNG {kb_png:.0f}KB → SVG {kb_svg:.0f}KB")
            mism = r["missing_pixels"] + r["extra_pixels"]
            print(f"      回栅格化比对: 不匹配 {mism}/{r['ink_pixels']} "
                  f"= {r['mismatch_ratio']*100:.3f}%  (缺 {r['missing_pixels']} / "
                  f"多 {r['extra_pixels']}，容差 {r['tolerance_px']}px，"
                  f"上限 {r['limit']*100:.1f}%)")
    if not total:
        print("没有可矢量化的插图")
        return 0
    print(f"\n合计 {total} 幅，失败 {failed} 幅")
    return 1 if failed else 0


# ---------------- cap5 ----------------

def cmd_render(a) -> int:
    root = Path(a.root)
    pdir = _page_dir(root, a.book, a.page)
    sdir = _stitch_dir(root, a.book, a.page)
    meta, page = sdir / "meta.json", pdir / "page.json"

    if a.source == "cap1":
        src = page
    elif a.source == "cap2":
        src = meta
    else:
        src = meta if meta.exists() else page
    if not src.exists():
        print(f"ERROR: 找不到 {src}", file=sys.stderr)
        return 2

    out = Path(a.out) if a.out else pdir / f"{a.book}_p{a.page:04d}.html"
    proc = subprocess.run(
        ["node", str(SKILL_DIR / "tools" / "render_page.js"),
         str(src.resolve()), str(out.resolve()), str(pdir.resolve())],
        capture_output=True, text=True, cwd=str(SKILL_DIR),
    )
    if proc.returncode != 0:
        print(f"ERROR: 渲染失败\n{proc.stderr[:500]}", file=sys.stderr)
        return 1
    info = json.loads(proc.stdout)
    print(f"[cap5] {a.book} p{a.page:04d}: 源={src.name}  "
          f"{info['rendered']}/{info['blocks']} blocks 入流  "
          f"{info['bytes']/1024:.0f}KB 自包含 HTML")
    for s in info.get("skipped", []):
        print(f"  ⤵ 跳过 {s['id']}：{s['reason']}")
    print(f"  -> {out}")
    return 0


# ---------------- main ----------------

def main() -> int:
    ap = argparse.ArgumentParser(prog="ldmath")
    sub = ap.add_subparsers(dest="cmd", required=True)
    default_profile = str(SKILL_DIR / "profiles" / "soviet-cn.json")

    def common(p):
        p.add_argument("--book", required=True)
        p.add_argument("--root", default=".tmp/ld-mathpdf")
        p.add_argument("--profile", default=default_profile)

    p = sub.add_parser("prepare", help="cap1 备料：渲染+版面分割+裁图")
    common(p); p.add_argument("--pdf", required=True)
    p.add_argument("--page", type=int, required=True); p.add_argument("--dpi", type=int, default=300)
    p.set_defaults(func=cmd_prepare)

    p = sub.add_parser("finalize", help="cap1 收口：规范化+校验")
    common(p); p.add_argument("--pdf", required=True); p.add_argument("--page", type=int, required=True)
    p.set_defaults(func=cmd_finalize)

    p = sub.add_parser("window", help="cap2 备料：汇集三页事实")
    common(p); p.add_argument("--page", type=int, required=True)
    p.set_defaults(func=cmd_window)

    p = sub.add_parser("stitch-check", help="cap2 收口：阻断增删改")
    common(p); p.add_argument("--page", type=int, required=True)
    p.set_defaults(func=cmd_stitch_check)

    p = sub.add_parser("consistency", help="cap3 全书一致性")
    common(p)
    p.set_defaults(func=cmd_consistency)

    p = sub.add_parser("render", help="cap5 单页 → 自包含 HTML")
    common(p); p.add_argument("--page", type=int, required=True)
    p.add_argument("--out", help="输出 html 路径（默认写到该页目录）")
    p.add_argument("--source", choices=["auto", "cap1", "cap2"], default="auto",
                   help="用 cap1 的 page.json 还是 cap2 的 meta.json；auto 优先 cap2")
    p.set_defaults(func=cmd_render)

    p = sub.add_parser("vectorize", help="cap4 插图截图 → SVG（描摹 + 保真自检）")
    common(p); p.add_argument("--page", type=int)
    p.add_argument("--turdsize", type=int, default=2, help="丢弃的最小斑点面积，越大越干净越不保真")
    p.add_argument("--alphamax", type=float, default=1.0)
    p.set_defaults(func=cmd_vectorize)

    a = ap.parse_args()
    return a.func(a)


if __name__ == "__main__":
    sys.exit(main())
