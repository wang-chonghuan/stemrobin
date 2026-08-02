"""cap4：插图截图 → SVG。

方法是**位图描摹**（potrace 算法），不是让模型"看图重画"。
理由与本技能的铁律一致：描摹是确定性的，逐像素还原原图轮廓，不会像重画那样
把「椭圆」画成「圆」、把格子数画错。模型重画看着漂亮，但那是再创作，不是转换。

保真由机器判定：用 resvg（真正的 SVG 渲染引擎）把生成的 SVG 回栅格化，
与原 PNG 逐像素比对，不匹配率超过阈值即判失败。
"和截图一样准确"因此是被验证的，不是被声称的。

两个必须记住的坑（都是实测定下来的，不是推测）：
  1. potrace 位图极性：要传**反相**的墨迹掩码（等价于"灰度 >= 阈值"的掩码）。
  2. even-odd 填充规则只在**单个 <path> 元素内部**生效。所有轮廓必须合并进一个
     <path d="...">，否则孔洞无法抵消，整个图会被填死。
"""
from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import potrace
from PIL import Image

TOOLS = Path(__file__).resolve().parent
SKILL = TOOLS.parent

INK_THRESHOLD = 128
DEFAULT_TURDSIZE = 2      # 描摹时丢弃的最小斑点面积（像素）。2 = potrace 默认，最保真
DEFAULT_ALPHAMAX = 1.0    # 拐角平滑度；1.0 = potrace 默认
MISMATCH_LIMIT = 0.02     # 不匹配率上限（占原图墨迹面积）
EDGE_TOLERANCE = 1        # 边界容差（像素）。矢量边界落在像素中间，抗锯齿必然有 1px 差


def _ink(png: Path) -> np.ndarray:
    """墨迹掩码：True = 有墨（暗）。"""
    return np.asarray(Image.open(png).convert("L")) < INK_THRESHOLD


def _pt(p) -> tuple[float, float]:
    return (p.x, p.y)


def _svg_path_d(curve) -> str:
    sx, sy = _pt(curve.start_point)
    d = [f"M{sx:.2f} {sy:.2f}"]
    for seg in curve:
        if seg.is_corner:
            cx, cy = _pt(seg.c)
            ex, ey = _pt(seg.end_point)
            d.append(f"L{cx:.2f} {cy:.2f}L{ex:.2f} {ey:.2f}")
        else:
            c1x, c1y = _pt(seg.c1)
            c2x, c2y = _pt(seg.c2)
            ex, ey = _pt(seg.end_point)
            d.append(f"C{c1x:.2f} {c1y:.2f} {c2x:.2f} {c2y:.2f} {ex:.2f} {ey:.2f}")
    d.append("Z")
    return "".join(d)


def _dilate(mask: np.ndarray, r: int) -> np.ndarray:
    """r 像素膨胀（纯 numpy 位移，避免引入 scipy）。"""
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dy == 0 and dx == 0:
                continue
            out |= np.roll(np.roll(mask, dy, axis=0), dx, axis=1)
    return out


def _render_svg(svg_path: Path, out_png: Path) -> dict:
    # 必须用绝对路径：子进程 cwd 是技能目录，相对路径会解析错
    proc = subprocess.run(
        ["node", str(TOOLS / "svg_raster.js"),
         str(svg_path.resolve()), str(out_png.resolve())],
        capture_output=True, text=True, cwd=str(SKILL),
    )
    if proc.returncode != 0:
        return {"ok": False, "error": (proc.stdout or proc.stderr)[:200]}
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {"ok": False, "error": proc.stdout[:200]}


def build_svg(ink: np.ndarray, turdsize: int, alphamax: float) -> tuple[str, int]:
    h, w = ink.shape
    # 坑 1：potrace 要反相位图
    path = potrace.Bitmap(~ink).trace(turdsize=turdsize, alphamax=alphamax)
    curves = list(path)
    # 坑 2：所有轮廓必须在同一个 <path> 里，even-odd 才能抵消孔洞
    d = "".join(_svg_path_d(c) for c in curves)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'width="{w}" height="{h}" color="#000" role="img">\n'
        f'  <path fill="currentColor" fill-rule="evenodd" d="{d}"/>\n'
        f'</svg>\n'
    )
    return svg, len(curves)


def vectorize(png: Path, svg_out: Path, turdsize: int = DEFAULT_TURDSIZE,
              alphamax: float = DEFAULT_ALPHAMAX) -> dict:
    src = _ink(png)
    h, w = src.shape
    svg, n_curves = build_svg(src, turdsize, alphamax)
    svg_out.parent.mkdir(parents=True, exist_ok=True)
    svg_out.write_text(svg, encoding="utf-8")

    # —— 保真自检：用真正的渲染引擎回栅格化，再逐像素比对 ——
    with tempfile.TemporaryDirectory() as td:
        chk = Path(td) / "check.png"
        r = _render_svg(svg_out, chk)
        if not r.get("ok"):
            return {"svg": str(svg_out), "ok": False,
                    "error": f"SVG 无法渲染: {r.get('error')}"}
        got = _ink(chk)

    if got.shape != src.shape:
        return {"svg": str(svg_out), "ok": False,
                "error": f"回栅格化尺寸不符 {got.shape} != {src.shape}"}

    # 矢量边界落在像素中间，抗锯齿必然产生 1px 级差异，故用容差比对
    src_d = _dilate(src, EDGE_TOLERANCE)
    got_d = _dilate(got, EDGE_TOLERANCE)
    missing = int((src & ~got_d).sum())
    extra = int((got & ~src_d).sum())
    ink_px = int(src.sum())
    ratio = (missing + extra) / ink_px if ink_px else 0.0

    return {
        "svg": str(svg_out),
        "size": [w, h],
        "curves": n_curves,
        "svg_bytes": len(svg.encode("utf-8")),
        "png_bytes": png.stat().st_size,
        "ink_pixels": ink_px,
        "missing_pixels": missing,
        "extra_pixels": extra,
        "mismatch_ratio": round(ratio, 5),
        "limit": MISMATCH_LIMIT,
        "tolerance_px": EDGE_TOLERANCE,
        "ok": ratio <= MISMATCH_LIMIT,
        "params": {"turdsize": turdsize, "alphamax": alphamax},
    }


def vectorize_page(page_dir: Path, turdsize: int = DEFAULT_TURDSIZE,
                   alphamax: float = DEFAULT_ALPHAMAX) -> dict:
    figs = sorted((page_dir / "figures").glob("fig-*.png"))
    results = [vectorize(f, f.with_suffix(".svg"), turdsize, alphamax) for f in figs]
    report = {"page_dir": str(page_dir), "figures": len(results), "results": results,
              "ok": all(r["ok"] for r in results)}
    (page_dir / "vectorize.report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Deterministically trace a high-contrast PNG into a pure SVG path."
    )
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--turdsize", type=int, default=DEFAULT_TURDSIZE)
    parser.add_argument("--alphamax", type=float, default=DEFAULT_ALPHAMAX)
    args = parser.parse_args()
    if not args.input.is_file():
        parser.error(f"input does not exist: {args.input}")
    if args.output.suffix.lower() != ".svg":
        parser.error("--output must end in .svg")
    result = vectorize(args.input, args.output, args.turdsize, args.alphamax)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
