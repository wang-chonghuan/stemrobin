#!/usr/bin/env python
"""ld-page2class —— 扫描教材 PDF → 按小节成课、按题成件。

    p2c.py prepare   --book 5m --page 15      # 渲染整页 + 坐标网格图
    #  ↓ 视觉环节：读 page.grid.png，写 page.md（带类型的块）
    p2c.py finalize  --book 5m --page 15      # 吸附裁图 + 规范化 + 页级体检
    p2c.py assemble  --book 5m                # 跨页装订 → 小节 + 独立编号的题
    p2c.py vectorize --book 5m                # 插图 PNG → SVG（描摹 + 保真自检）
    p2c.py render    --book 5m [--lesson id]  # 自包含 HTML（课文页 + 习题页）
    p2c.py publish   --book 5m [--dry]        # 写进内容库，产品里就能点开了

机器不猜哪里是图、哪一段是第几题——那是模型看图的活；
模型也不量像素、不做跨页拼接、不做全书对账——那是机器的活。
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import blocks as B
import layout
import mathcheck
import normalize as nz
from PIL import Image

SKILL = Path(__file__).resolve().parent.parent
TOOLS = SKILL / "tools"
DEFAULT_ROOT = Path("page2class")
DEFAULT_BOOKS = Path(".tmp/ori-books")
DEFAULT_PROFILE = SKILL / "profiles" / "soviet-cn.json"

ENUM_LINE = re.compile(r"^\s*(?:\d+\.\s*)?([^\W\d_])\s*[)）]", re.M)


def _dump(p: Path, o) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(o, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _book_dir(a) -> Path:
    return Path(a.root) / a.book


def _page_dir(a, page: int) -> Path:
    return _book_dir(a) / "pages" / f"{page:04d}"


def _find_pdf(a) -> Path:
    if getattr(a, "pdf", None):
        return Path(a.pdf)
    books = Path(a.books)
    pattern = f"{a.series}/*.pdf" if getattr(a, "series", None) else "*/*.pdf"
    hits = sorted(p for p in books.glob(pattern)
                  if p.stem == a.book or p.stem.startswith(a.book + " "))
    if not hits:
        raise SystemExit(f"ERROR: {books}/{pattern} 里找不到书名以 {a.book!r} 开头的 PDF")
    if len(hits) > 1:
        raise SystemExit(f"ERROR: {a.book!r} 匹配到多本，用 --series 指明: "
                         + ", ".join(f"{p.parent.name}/{p.name}" for p in hits))
    return hits[0]


TEMPLATE = """---
{meta}
---

<!-- 照着 page.grid.png 写。块头声明这一块是什么，块体里**一行 = 印刷一行**：

  <!-- h1 --> 章  <!-- h2 --> §  <!-- h3 --> 小节标题
  <!-- p -->  正文段
  <!-- exhead --> 习题栏标题（复习题/家庭作业题）
  <!-- ex 20 --> 第 20 题（原书题号）
  <!-- fig 图 7 box 790,1640,490,250 -->  插图/表格，框照网格估，收口会吸附
  <!-- cap 图 7 --> 印刷出来的图题行     <!-- foot --> 页码

块头可加 cont（承接上页同一对象）/ open（延续到下页），跨页装订全靠这两个标记。
一条公式被印刷从中间切开时：公式写完整，断点处写 ↵。
删掉本条注释。 -->
"""


# ---------------------------------------------------------------- cap1 备料
def cmd_prepare(a) -> int:
    pdf = _find_pdf(a)
    pdir = _page_dir(a, a.page)
    pdir.mkdir(parents=True, exist_ok=True)

    png = layout.render_page(pdf, a.page, pdir / "page.png", dpi=a.dpi)
    layout.grid_overlay(png, pdir / "page.grid.png")
    img = Image.open(png)
    ink = layout.ink_mask(img)
    cols = ink.any(axis=0).nonzero()[0]
    content_w = int(cols[-1] - cols[0] + 1) if cols.size else img.width
    bands = layout.line_bands(ink, content_w)

    profile = json.loads(DEFAULT_PROFILE.read_text(encoding="utf-8"))
    meta = {
        "schema": "ld-page2class/page@3", "book": a.book, "page": a.page,
        "printed_page": None,
        "source": {"pdf": pdf.name, "pdf_sha256": layout.sha256_file(pdf),
                   "pdf_page": a.page},
        "render": {"dpi": a.dpi, "w": img.width, "h": img.height,
                   "sha256": layout.sha256_file(png)},
        "profile": {"id": profile["id"], "sha256": layout.sha256_file(DEFAULT_PROFILE)},
        "notes": [],
    }
    _dump(pdir / "layout.json", {"w": img.width, "h": img.height,
                                 "content_width": content_w,
                                 "line_bands": [[int(x), int(y)] for x, y in bands]})
    if not (pdir / "page.template.md").exists() or a.force:
        (pdir / "page.template.md").write_text(
            TEMPLATE.format(meta=json.dumps(meta, ensure_ascii=False, indent=2)),
            encoding="utf-8")
    print(f"[prepare] {a.book} p{a.page:04d} -> {pdir}")
    print(f"  {img.width}x{img.height} @{a.dpi}dpi  印刷行 {len(bands)} 行"
          f"  读图用 page.grid.png（网格 {layout.GRID}px）")
    return 0


# ---------------------------------------------------------------- cap1 收口
def cmd_finalize(a) -> int:
    pdir = _page_dir(a, a.page)
    md_path = pdir / "page.md"
    if not md_path.exists():
        print(f"ERROR: 缺少 {md_path}（视觉转写尚未产出）", file=sys.stderr)
        return 2

    meta, blks = B.parse(md_path.read_text(encoding="utf-8"))
    profile = nz.load_profile(DEFAULT_PROFILE)
    img = Image.open(pdir / "page.png")
    ink = layout.ink_mask(img)
    errors: list[str] = []

    # 1) 插图：粗框吸附到真实墨迹再裁；文件名用原书图号，跨页唯一
    figs, seq = [], 0
    for b in blks:
        if b["kind"] != "fig":
            continue
        seq += 1
        if not b.get("box"):
            errors.append(f"fig {b.get('label')}: 缺 box")
            continue
        b["id"] = B.fig_id(b.get("label"), a.page, seq)
        box, info = layout.snap(ink, b["box"])
        b["box"] = box
        layout.crop(pdir / "page.png", box, pdir / "figures" / f"{b['id']}.png")
        figs.append({"id": b["id"], "label": b.get("label"), "box": box, **info})
        if info.get("components", 0) == 0:
            errors.append(f"{b['id']}: 粗框里没有完整连通域，框可能给错了")
    for i in range(len(figs)):
        for j in range(i + 1, len(figs)):
            (x1, y1, w1, h1), (x2, y2, w2, h2) = figs[i]["box"], figs[j]["box"]
            if x1 < x2 + w2 and x2 < x1 + w1 and y1 < y2 + h2 and y2 < y1 + h1:
                errors.append(f"{figs[i]['id']} 与 {figs[j]['id']} 框重叠，"
                              "同一块墨迹会被裁两次")
    keep = {f"{f['id']}.png" for f in figs}
    for stale in (pdir / "figures").glob("*.png"):
        if stale.name not in keep:
            stale.unlink()

    # 2) 行数对账：挖掉插图后的印刷行数 == 块体行数。页级唯一的完整性硬证据。
    masked = ink.copy()
    for f in figs:
        x, y, w, h = f["box"]
        masked[max(0, y):y + h, max(0, x):x + w] = False
    cols = ink.any(axis=0).nonzero()[0]
    content_w = int(cols[-1] - cols[0] + 1) if cols.size else img.width
    want = len(layout.line_bands(masked, content_w))
    got = B.printed_lines(blks)
    if want != got:
        errors.append(f"行数对不上：印刷 {want} 行，块体 {got} 行"
                      "（块体一行 = 印刷一行；公式跨行用 ↵ 标断点）")

    # 3) 规范化 + 字符 + 公式 + 小问标号
    applied = []
    for b in blks:
        for i, ln in enumerate(b["lines"]):
            new, ch = nz.normalize_text(ln, profile)
            if new != ln:
                b["lines"][i] = new
                applied.append({"kind": b["kind"], "rules": sorted({c["rule"] for c in ch})})

    unknown, texts = [], []
    for n, b in enumerate(blks):
        t = B.text_of(b, join="")
        if not t and b["kind"] in B.KINDS_TEXT:
            errors.append(f"块 #{n+1} ({b['kind']}) 是空的")
        texts.append({"id": f"{b['kind']}#{n+1}", "text": t})
        for bad in nz.check_charset(t, profile):
            unknown.append({**bad, "block": f"{b['kind']}#{n+1}"})
    if unknown:
        errors.append("白名单外字符 %d 处: %s" % (
            len(unknown), ", ".join(f"{u['char']}({u['codepoint']})" for u in unknown[:8])))

    m_err, m_warn = mathcheck.collect_and_check(texts, lambda x: [("text", x["text"])])
    # 跨页残片的公式配不平是必然的，校验义务推给 assemble（那时才有完整公式）
    open_ids = {f"{b['kind']}#{i+1}" for i, b in enumerate(blks) if b["open"] or b["cont"]}
    for e in m_err:
        if e.split(".")[0] in open_ids and "花括号" in e or e.split(".")[0] in open_ids and "配对" in e:
            continue
        errors.append(e)

    for i, b in enumerate(blks):
        if profile.get("enum_marker_script") != "cyrillic":
            break
        for key in ENUM_LINE.findall(B.text_of(b, join="\n")):
            if nz.enum_key_script(key) not in ("cyrillic", "numeric"):
                errors.append(f"{b['kind']}#{i+1}: 小问标号 {key!r} 不是西里尔")

    if meta.get("printed_page") is None:
        errors.append("printed_page 未填（页码承载溯源，不能空）")

    pdf = _find_pdf(a)
    meta |= {
        "schema": "ld-page2class/page@3", "book": a.book, "page": a.page,
        "source": {"pdf": pdf.name, "pdf_sha256": layout.sha256_file(pdf),
                   "pdf_page": a.page},
        "render": {"dpi": meta.get("render", {}).get("dpi", 300),
                   "w": img.width, "h": img.height,
                   "sha256": layout.sha256_file(pdir / "page.png")},
        "profile": {"id": profile["id"], "sha256": layout.sha256_file(DEFAULT_PROFILE)},
        "printed_lines": got, "figures": [{"id": f["id"], "label": f["label"],
                                           "box": f["box"]} for f in figs],
        "provenance": {"cap": "1", "normalized": True},
    }
    md_path.write_text(B.dump(meta, blks, a.page), encoding="utf-8")
    _dump(pdir / "page.json", {"meta": meta, "blocks": blks})
    _dump(pdir / "audit.json", {"page": a.page, "lines_printed": want, "lines_md": got,
                                "figures": figs, "normalizations": applied,
                                "unknown_chars": unknown, "katex_warnings": m_warn,
                                "errors": errors})

    print(f"[finalize] {a.book} p{a.page:04d}: {len(blks)} 块 / {got} 行"
          f"（印刷 {want}）, 插图 {len(figs)} 张, 规范化 {len(applied)} 处")
    for f in figs:
        print(f"    {f['id']}({f['label']}) → {f['box']}")
    if errors:
        print(f"  ✗ 失败 {len(errors)} 项:")
        for e in errors:
            print(f"    - {e}")
        return 1
    print("  ✓ 通过 行数对账 + 白名单 + 公式")
    return 0


# ---------------------------------------------------------------- cap2 装订
def cmd_assemble(a) -> int:
    import assemble
    return assemble.run(_book_dir(a), Path(a.toc) if a.toc else None,
                        DEFAULT_PROFILE, strict=not a.lenient)


# ---------------------------------------------------------------- cap3 矢量化
def cmd_vectorize(a) -> int:
    import vectorize as V
    book = _book_dir(a)
    pngs = sorted(book.glob("pages/*/figures/*.png"))
    if a.page:
        pngs = [p for p in pngs if f"/{a.page:04d}/" in str(p)]
    ok = fail = 0
    for png in pngs:
        svg = png.with_suffix(".svg")
        r = V.vectorize(png, svg, turdsize=a.turdsize)
        mark = "✓" if r["ok"] else "✗"
        print(f"  {mark} {png.parent.parent.name}/{png.stem}  "
              f"不匹配 {r['mismatch_ratio'] * 100:.3f}%  {svg.stat().st_size // 1024}KB")
        ok, fail = (ok + 1, fail) if r["ok"] else (ok, fail + 1)
    print(f"[vectorize] {ok} 张通过, {fail} 张不匹配超限")
    return 1 if fail else 0


# ---------------------------------------------------------------- cap4 成品
def cmd_render(a) -> int:
    book = _book_dir(a)
    args = ["node", str(TOOLS / "render_lesson.js"), str(book)]
    if a.lesson:
        args.append(a.lesson)
    return subprocess.run(args).returncode


# ---------------------------------------------------------------- cap5 入库
def cmd_publish(a) -> int:
    args = ["node", str(TOOLS / "publish.mjs"), str(_book_dir(a))]
    if a.dry:
        args.append("--dry")
    args += ["--env", a.env]
    return subprocess.run(args).returncode


def main() -> int:
    ap = argparse.ArgumentParser(prog="p2c.py", description="扫描教材 → 小节 + 题")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p, page=True):
        p.add_argument("--book", required=True)
        if page:
            p.add_argument("--page", type=int, required=True)
        p.add_argument("--root", default=str(DEFAULT_ROOT))
        p.add_argument("--books", default=str(DEFAULT_BOOKS))
        p.add_argument("--series", default=None)
        p.add_argument("--pdf", default=None)

    p = sub.add_parser("prepare", help="渲染整页 + 坐标网格图")
    common(p); p.add_argument("--dpi", type=int, default=300)
    p.add_argument("--force", action="store_true"); p.set_defaults(fn=cmd_prepare)

    p = sub.add_parser("finalize", help="吸附裁图 + 规范化 + 页级体检")
    common(p); p.set_defaults(fn=cmd_finalize)

    p = sub.add_parser("assemble", help="跨页装订 → 小节 + 独立编号的题")
    common(p, page=False)
    p.add_argument("--toc", default=None, help="TOC JSON；给了就核对小节覆盖")
    p.add_argument("--lenient", action="store_true", help="对账不通过也写出产物")
    p.set_defaults(fn=cmd_assemble)

    p = sub.add_parser("vectorize", help="插图 PNG → SVG（描摹 + 保真自检）")
    common(p, page=False); p.add_argument("--page", type=int, default=None)
    p.add_argument("--turdsize", type=int, default=2); p.set_defaults(fn=cmd_vectorize)

    p = sub.add_parser("render", help="自包含 HTML：课文页 + 习题页")
    common(p, page=False); p.add_argument("--lesson", default=None)
    p.set_defaults(fn=cmd_render)

    p = sub.add_parser("publish", help="写进内容库（一个小节 = 一行，id 用卡片 id）")
    common(p, page=False)
    p.add_argument("--dry", action="store_true", help="只打印要写什么，不连库")
    p.add_argument("--env", default=".env", help="连接串所在的 .env")
    p.set_defaults(fn=cmd_publish)

    a = ap.parse_args()
    return a.fn(a)


if __name__ == "__main__":
    raise SystemExit(main())
