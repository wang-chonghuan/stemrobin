"""cap2 装订：页 → 小节 + 独立编号的题。

页是扫描的产物，小节和题才是要交付的对象，两者都不认页边界。cap1 已经把每一块
标了类型、标了 cont/open，所以这里是**纯拼接**，不需要再猜：

  1. 合流   —— open 的块和下一页 cont 的块接成一个对象（跨页的段、跨页的题）
  2. 切小节 —— h3 开一节，h1/h2 是它的祖先标题
  3. 分流   —— ex/exhead 进习题，其余进课文（块类型已经说明了一切）
  4. 认领图 —— 谁的正文里提到「图 7」，图就归谁；题引用的图跟着那道题走

对账全部是**对象级**的，比页级像素对账便宜也强得多：题号连续、图号连续、
图与引用双向齐全、TOC 小节覆盖、拼完整之后的公式再过一遍 KaTeX。
一页漏抽、一题读错号、一张图没裁，都会在这里露出来。
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import blocks as B
import mathcheck
import normalize as nz

FIGREF = re.compile(r"图\s*(\d+)")
SEC_NUM = re.compile(r"^\s*(\d+)\s*[.．、]\s*(.+)$")


def _slug(text: str) -> str:
    return re.sub(r"[^\w一-鿿]+", "-", text.strip()).strip("-")[:40]


def load_stream(book: Path) -> list[dict]:
    """所有页的块按页序连成一条流，每块记住自己来自哪一页。"""
    stream = []
    for pj in sorted(book.glob("pages/*/page.json")):
        doc = json.loads(pj.read_text(encoding="utf-8"))
        page = doc["meta"]["page"]
        for i, b in enumerate(doc["blocks"]):
            stream.append({**b, "page": page,
                           "printed_page": doc["meta"].get("printed_page"),
                           "ref": f"p{page:04d}#{i+1}"})
    return stream


def merge_across_pages(stream: list[dict]) -> tuple[list[dict], list[str]]:
    """open 的块与下一页 cont 的块接成一个对象。文本一个字不改，只是接上。"""
    # 页码、插图、图题都可能夹在一个对象的两半之间（文字环绕的插图、页脚），
    # 配对时要当它们不存在——否则一段被插图打断的正文就永远接不上。
    TRANSPARENT = ("foot", "fig", "cap")
    out, warn = [], []
    for b in stream:
        prev = next((x for x in reversed(out) if x["kind"] not in TRANSPARENT), None)
        if b["kind"] in TRANSPARENT:
            out.append(dict(b))
            continue
        if b.get("cont"):
            if prev is None or not prev.get("open"):
                warn.append(f"{b['ref']}: 标了 cont，但上一块没标 open")
            elif prev["kind"] != b["kind"] or (
                    b["kind"] == "ex" and prev.get("label") not in (None, b.get("label"))):
                warn.append(f"{b['ref']}: cont 接不上——上块是 {prev['kind']}"
                            f"{prev.get('label') or ''}，本块是 {b['kind']}{b.get('label') or ''}")
            else:
                prev["lines"] += b["lines"]
                prev["open"] = b.get("open", False)
                prev.setdefault("spans", [prev["ref"]]).append(b["ref"])
                continue
        elif prev is not None and prev.get("open") and prev["page"] != b["page"]:
            warn.append(f"{prev['ref']}: 标了 open，但下一页首块没标 cont")
        out.append(dict(b))
    return out, warn


def cut_lessons(stream: list[dict]) -> list[dict]:
    """h3 开一节。h1/h2 记作祖先标题，跟着下一节走。"""
    lessons, pending = [], {"h1": None, "h2": None}
    cur = None
    for b in stream:
        if b["kind"] in ("h1", "h2"):
            pending[b["kind"]] = B.text_of(b)
            if b["kind"] == "h1":
                pending["h2"] = None
            continue
        if b["kind"] == "h3":
            title = B.text_of(b)
            m = SEC_NUM.match(title)
            cur = {"chapter": pending["h1"], "section": pending["h2"],
                   "number": m.group(1) if m else None,
                   "title": m.group(2).strip() if m else title,
                   "printed_title": title, "blocks": [],
                   "start_page": b["page"], "start_printed": b.get("printed_page")}
            lessons.append(cur)
            continue
        if b["kind"] == "foot":
            continue
        if cur is None:                     # 小节标题之前的内容（承前页的残段）
            cur = {"chapter": pending["h1"], "section": pending["h2"], "number": None,
                   "title": "（承上页）", "printed_title": None, "blocks": [],
                   "start_page": b["page"], "start_printed": b.get("printed_page")}
            lessons.append(cur)
        cur["blocks"].append(b)
    return lessons


def split_lesson(lesson: dict) -> tuple[list[dict], list[dict]]:
    """块类型已经说明了一切：ex/exhead 进习题，其余进课文。"""
    prose, exercises, group = [], [], None
    for b in lesson["blocks"]:
        if b["kind"] == "exhead":
            group = B.text_of(b)
        elif b["kind"] == "ex":
            exercises.append({"number": b.get("label"), "group": group,
                              "text": B.text_of(b, join=""),
                              "lines": b["lines"], "pages": b.get("spans") or [b["ref"]],
                              "figures": []})
        else:
            prose.append(b)
    return prose, exercises


def claim_figures(lessons: list[dict], stream: list[dict]) -> list[str]:
    """谁提到「图 N」，图就归谁；题里提到的图跟着那道题走。"""
    warn = []
    fig_by_num, all_figs = {}, []
    for b in stream:
        if b["kind"] != "fig":
            continue
        all_figs.append(b)
        for n in FIGREF.findall(b.get("label") or ""):
            fig_by_num.setdefault(n, []).append(b)

    referenced = set()
    for lesson in lessons:
        for ex in lesson["exercises"]:
            for n in dict.fromkeys(FIGREF.findall(ex["text"])):
                referenced.add(n)
                for f in fig_by_num.get(n, []):
                    ex["figures"].append({"id": f["id"], "label": f.get("label")})
                if n not in fig_by_num:
                    warn.append(f"第 {ex['number']} 题引用「图 {n}」，全书没有这张图")
        for b in lesson["prose"]:
            for n in FIGREF.findall(B.text_of(b)):
                referenced.add(n)
        lesson["figures"] = [{"id": b["id"], "label": b.get("label"), "page": b["page"]}
                             for b in lesson["blocks"] if b["kind"] == "fig"]

    for f in all_figs:
        nums = FIGREF.findall(f.get("label") or "")
        if nums and not (set(nums) & referenced):
            warn.append(f"{f['id']}（{f.get('label')}）全书没有任何正文引用它")
    return warn


def audit(lessons: list[dict], stream: list[dict], profile_path: Path) -> dict:
    """对象级对账。页级像素对账管不到的东西，这里全能看见。"""
    errors, warns = [], []

    nums = [int(e["number"]) for l in lessons for e in l["exercises"]
            if (e["number"] or "").isdigit()]
    seq = sorted(nums)
    if len(seq) != len(set(seq)):
        dup = sorted({n for n in seq if seq.count(n) > 1})
        errors.append(f"题号重复: {dup}")
    gaps = [n for n in range(seq[0], seq[-1]) if n not in set(seq)] if seq else []
    if gaps:
        errors.append(f"题号缺号: {gaps}（可能漏页或漏题）")

    fignums = sorted({int(n) for b in stream if b["kind"] == "fig"
                      for n in FIGREF.findall(b.get("label") or "")})
    fgaps = [n for n in range(fignums[0], fignums[-1]) if n not in set(fignums)] \
        if fignums else []
    if fgaps:
        errors.append(f"图号缺号: {fgaps}（可能漏裁）")

    # 拼完整之后再校验公式——跨页残片在 cap1 是配不平的，义务推到了这里
    items = []
    for li, l in enumerate(lessons):
        for b in l["prose"]:
            items.append({"id": f"{l['title']}/{b['ref']}", "text": B.text_of(b)})
        for e in l["exercises"]:
            items.append({"id": f"{l['title']}/第{e['number']}题", "text": e["text"]})
    m_err, m_warn = mathcheck.collect_and_check(items, lambda x: [("text", x["text"])])
    errors += m_err

    open_tail = [b["ref"] for b in stream if b.get("open")]
    if open_tail:
        warns.append(f"仍有 {len(open_tail)} 个块标着 open 没接上（书还没抽完是正常的）: "
                     + ", ".join(open_tail[:5]))
    return {"errors": errors, "warnings": warns, "exercise_range":
            [seq[0], seq[-1]] if seq else None, "exercise_count": len(seq),
            "figure_numbers": fignums, "katex_warnings": m_warn}


def check_toc(lessons: list[dict], toc_path: Path, book_id: str) -> list[str]:
    """TOC 是外部真源：它说有几个小节，就该出现几个小节。"""
    toc = json.loads(toc_path.read_text(encoding="utf-8"))
    topics = [t for c in toc.get("contents", []) for l in c.get("lessons", [])
              for t in l.get("topics", [])]
    covered = {l["number"] for l in lessons if l["number"]}
    pages = [l["start_printed"] for l in lessons if l["start_printed"]]
    if not pages:
        return []
    lo, hi = min(pages), max(pages)
    missing = [f"{t['printedNumber']}. {t['title']}（印刷页 {t['page']}）"
               for t in topics if lo <= t["page"] <= hi
               and str(t["printedNumber"]) not in covered]
    return [f"TOC 里这些小节落在已抽范围内却没装订出来: {'; '.join(missing)}"] if missing else []


def run(book: Path, toc: Path | None, profile: Path, strict: bool = True) -> int:
    stream = load_stream(book)
    if not stream:
        print(f"ERROR: {book}/pages 下没有 page.json", file=sys.stderr)
        return 2

    merged, warn_merge = merge_across_pages(stream)
    lessons = cut_lessons(merged)
    for l in lessons:
        l["prose"], l["exercises"] = split_lesson(l)
    warn_fig = claim_figures(lessons, merged)
    report = audit(lessons, merged, profile)
    report["warnings"] = warn_merge + warn_fig + report["warnings"]
    if toc:
        report["errors"] += check_toc(lessons, toc, book.name)

    # 全书图库：页目录里的裁图按原书图号汇总，重号即报
    lib = book / "figures"
    lib.mkdir(parents=True, exist_ok=True)
    seen = {}
    for png in sorted(book.glob("pages/*/figures/*.png")):
        if png.stem in seen:
            report["warnings"].append(
                f"图号 {png.stem} 在 {seen[png.stem]} 和 {png.parent.parent.name} 各出现一次")
        seen[png.stem] = png.parent.parent.name
        for src in (png, png.with_suffix(".svg")):
            if src.exists():
                shutil.copy2(src, lib / src.name)

    out = book / "lessons"
    shutil.rmtree(out, ignore_errors=True)
    index = []
    for i, l in enumerate(lessons, 1):
        lid = f"{l['number'] or f'x{i}'}-{_slug(l['title'])}"
        d = out / lid
        d.mkdir(parents=True, exist_ok=True)
        head = " · ".join(x for x in (l["chapter"], l["section"]) if x)
        md = [f"# {l['printed_title'] or l['title']}", ""]
        if head:
            md += [f"> {head}", ""]
        for b in l["prose"]:
            if b["kind"] == "fig":
                md += [f"![{b.get('label') or ''}](../../figures/{b['id']}.svg)", ""]
            elif b["kind"] == "cap":
                md += [f"*{B.text_of(b)}*", ""]
            else:
                md += [B.text_of(b), ""]
        (d / "lesson.md").write_text("\n".join(md).rstrip() + "\n", encoding="utf-8")
        (d / "exercises.json").write_text(json.dumps(
            {"lesson": lid, "count": len(l["exercises"]), "exercises": l["exercises"]},
            ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (d / "lesson.json").write_text(json.dumps(
            {"id": lid, "chapter": l["chapter"], "section": l["section"],
             "number": l["number"], "title": l["title"],
             "printed_title": l["printed_title"], "start_page": l["start_page"],
             "start_printed": l["start_printed"],
             "figures": l["figures"], "exercise_count": len(l["exercises"]),
             "prose": [{"kind": b["kind"], "text": B.text_of(b),
                        "id": b.get("id"), "label": b.get("label"),
                        "printed_page": b.get("printed_page")}
                       for b in l["prose"]]},
            ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        index.append({"id": lid, "title": l["title"], "number": l["number"],
                      "start_printed": l["start_printed"],
                      "prose_blocks": len(l["prose"]),
                      "exercises": len(l["exercises"]), "figures": len(l["figures"])})

    (book / "book.json").write_text(json.dumps(
        {"book": book.name, "pages": len({b["page"] for b in stream}),
         "lessons": index, "audit": report}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")

    print(f"[assemble] {book.name}: {len({b['page'] for b in stream})} 页 → "
          f"{len(lessons)} 个小节, {report['exercise_count']} 道题, "
          f"{len(report['figure_numbers'])} 张编号插图")
    for it in index:
        print(f"    {it['id']:<24} 印刷页 {it['start_printed'] or '?':>3}  "
              f"正文 {it['prose_blocks']:>2} 块  题 {it['exercises']:>2} 道  "
              f"图 {it['figures']} 张")
    for w in report["warnings"]:
        print(f"  ⚠ {w}")
    if report["errors"]:
        print(f"  ✗ 失败 {len(report['errors'])} 项:")
        for e in report["errors"]:
            print(f"    - {e}")
        return 1 if strict else 0
    print("  ✓ 通过 题号连续 + 图号连续 + 引用齐全 + 公式")
    return 0
