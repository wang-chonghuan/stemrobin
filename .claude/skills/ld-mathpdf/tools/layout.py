"""ld-mathpdf 版面分割（确定性）。

只负责「提候选」：把整页扫描图切成阅读顺序的条带，并挑出疑似插图/表格的块，
裁出 PNG。文字内容与最终块类型由 cap1 的视觉环节确认——本模块不做 OCR，
也不允许猜测文字。

判据（针对 1-bit 老扫描，无需 ML 模型）：
  * 行投影切带 → 估计正文行高
  * 显著高于行高的条带 = 插图候选
  * 含长横线（≥30% 版心宽）的条带 = 带框图/表格候选
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

INK_THRESHOLD = 128          # 灰度低于此值视为墨迹
ROW_INK_MIN_RATIO = 0.008    # 行墨迹占版心宽比例低于此值视为空白（抑制扫描噪点）
MIN_BAND_HEIGHT = 4          # 低于此高度的条带视为噪声，丢弃
FIGURE_HEIGHT_FACTOR = 6.0   # 无框时，条带高度 / 正文行高 超过此倍数才算插图
LONG_LINE_RATIO = 0.30       # 横线长度 / 版心宽 超过此值 → 有横框线
VLINE_RATIO = 0.50           # 竖线长度 / 条带高 超过此值 → 有竖线（坐标轴/表格竖线）
MIN_FIGURE_HEIGHT_FACTOR = 2.0  # 任何插图至少要有这么高
EDGE_EXCLUDE_RATIO = 0.06    # 竖线检测时排除左右页边（扫描页边黑线会被误判为坐标轴）
MARGIN_SCAN_RATIO = 0.10     # 上下各 10% 视为页眉页脚区
MARGIN_INK_MIN_RATIO = 0.002 # 页边区用更低阈值，捞回页码这类短行
MERGE_GAP_FACTOR = 0.6       # 相邻条带间距小于 行高*此值 则合并
CAPTION_MAX_WIDTH_RATIO = 0.6


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def render_page(pdf: Path, page: int, out_png: Path, dpi: int = 300) -> Path:
    out_png.parent.mkdir(parents=True, exist_ok=True)
    prefix = out_png.parent / "__render"
    subprocess.run(
        ["pdftoppm", "-png", "-r", str(dpi), "-f", str(page), "-l", str(page),
         str(pdf), str(prefix)],
        check=True, capture_output=True,
    )
    produced = sorted(out_png.parent.glob("__render-*.png"))
    if not produced:
        raise RuntimeError(f"pdftoppm 未产出页 {page}")
    produced[0].replace(out_png)
    for leftover in out_png.parent.glob("__render-*.png"):
        leftover.unlink()
    return out_png


def _ink_mask(img: Image.Image) -> np.ndarray:
    return np.asarray(img.convert("L")) < INK_THRESHOLD


def _row_max_run(row: np.ndarray) -> int:
    """一行中最长的连续墨迹段长度。"""
    if not row.any():
        return 0
    padded = np.concatenate(([0], row.view(np.int8), [0]))
    edges = np.flatnonzero(padded[1:] != padded[:-1])
    return int((edges[1::2] - edges[0::2]).max())


def _bands(ink: np.ndarray, content_width: int) -> list[tuple[int, int]]:
    """行投影切带。阈值按版心宽取，低于阈值的行视为空白，以压掉扫描噪点。"""
    counts = ink.sum(axis=1)
    live = counts > max(8, ROW_INK_MIN_RATIO * content_width)
    bands, start = [], None
    for y, on in enumerate(live):
        if on and start is None:
            start = y
        elif not on and start is not None:
            bands.append((start, y - 1))
            start = None
    if start is not None:
        bands.append((start, len(live) - 1))
    return [(a, b) for a, b in bands if b - a + 1 >= MIN_BAND_HEIGHT]


def _merge_close(bands: list[tuple[int, int]], gap: float) -> list[tuple[int, int]]:
    if not bands:
        return []
    out = [list(bands[0])]
    for a, b in bands[1:]:
        if a - out[-1][1] <= gap:
            out[-1][1] = b
        else:
            out.append([a, b])
    return [(a, b) for a, b in out]


def _tight_bbox(ink: np.ndarray, y0: int, y1: int) -> tuple[int, int, int, int]:
    sub = ink[y0:y1 + 1]
    cols = np.flatnonzero(sub.any(axis=0))
    rows = np.flatnonzero(sub.any(axis=1))
    if cols.size == 0 or rows.size == 0:
        return 0, y0, 0, y1 - y0 + 1
    x0, x1 = int(cols[0]), int(cols[-1])
    ty0, ty1 = y0 + int(rows[0]), y0 + int(rows[-1])
    return x0, ty0, x1 - x0 + 1, ty1 - ty0 + 1


def analyse(png: Path) -> dict:
    img = Image.open(png)
    ink = _ink_mask(img)
    h, w = ink.shape

    cols = np.flatnonzero(ink.any(axis=0))
    content_w = int(cols[-1] - cols[0] + 1) if cols.size else w

    raw = _bands(ink, content_w)
    if not raw:
        return {"w": w, "h": h, "text_line_height": 0, "candidates": []}

    heights = np.array([b - a + 1 for a, b in raw])
    line_h = int(np.median(heights))
    merged = _merge_close(raw, max(2.0, MERGE_GAP_FACTOR * line_h))

    long_line_min = LONG_LINE_RATIO * content_w
    cands = []
    for y0, y1 in merged:
        band_h = y1 - y0 + 1
        step = max(1, band_h // 40)
        has_frame = any(
            _row_max_run(ink[y]) >= long_line_min
            for y in range(y0, y1 + 1, step)
        )
        # 竖线：坐标轴、表格竖线、图框。正文没有长竖线，是区分图/文的强判据。
        # 页边缘要排除——扫描件常带整条页边黑线，会被误当成坐标轴。
        sub = ink[y0:y1 + 1]
        vline_min = VLINE_RATIO * band_h
        x_lo, x_hi = int(EDGE_EXCLUDE_RATIO * w), int((1 - EDGE_EXCLUDE_RATIO) * w)
        has_vline = band_h > MIN_FIGURE_HEIGHT_FACTOR * line_h and any(
            _row_max_run(sub[:, x]) >= vline_min
            for x in range(x_lo, x_hi, 4)
        )
        tall = band_h > FIGURE_HEIGHT_FACTOR * line_h
        is_fig = (band_h > MIN_FIGURE_HEIGHT_FACTOR * line_h
                  and (has_frame or has_vline or tall))
        x, ty, bw, bh = _tight_bbox(ink, y0, y1)
        cands.append({
            "bbox": [x, ty, bw, bh],
            "kind": "figure" if is_fig else "text_band",
            "has_frame": bool(has_frame),
            "has_vline": bool(has_vline),
            "height_ratio": round(band_h / line_h, 2) if line_h else None,
        })

    # 插图下方紧邻的窄条带 = 图题（如「图 14」），记录但不并入裁切范围
    for i, c in enumerate(cands):
        if c["kind"] != "figure" or i + 1 >= len(cands):
            continue
        nxt = cands[i + 1]
        if (nxt["kind"] == "text_band"
                and nxt["bbox"][2] < CAPTION_MAX_WIDTH_RATIO * content_w):
            c["caption_bbox"] = nxt["bbox"]
            nxt["kind"] = "caption"

    # 页眉页脚补捞：页码这类短行墨迹少，会低于正文行阈值而被丢掉。
    # 页码承载 printed_page，不能漏，故在上下页边用更低阈值单独重扫。
    covered = [(c["bbox"][1], c["bbox"][1] + c["bbox"][3]) for c in cands]
    margin = int(MARGIN_SCAN_RATIO * h)
    counts = ink.sum(axis=1)
    live = counts > max(3, MARGIN_INK_MIN_RATIO * content_w)
    for lo, hi in ((0, margin), (h - margin, h)):
        seg, start = [], None
        for y in range(lo, hi):
            if live[y] and start is None:
                start = y
            elif not live[y] and start is not None:
                seg.append((start, y - 1)); start = None
        if start is not None:
            seg.append((start, hi - 1))
        seg = [(s0, s1) for s0, s1 in seg if s1 - s0 + 1 >= 2]
        for a, b in _merge_close(seg, max(2.0, MERGE_GAP_FACTOR * line_h)):
            if any(a < ce and b > cs for cs, ce in covered):
                continue
            x, ty, bw, bh = _tight_bbox(ink, a, b)
            if bw == 0:
                continue
            cands.append({"bbox": [x, ty, bw, bh], "kind": "margin_band",
                          "has_frame": False, "has_vline": False,
                          "height_ratio": round((b - a + 1) / line_h, 2) if line_h else None})

    cands.sort(key=lambda c: c["bbox"][1])
    for i, c in enumerate(cands, 1):
        c["id"] = f"c{i:02d}"

    return {
        "w": w, "h": h,
        "content_width": content_w,
        "text_line_height": line_h,
        "candidates": cands,
    }


def crop_figures(png: Path, analysis: dict, out_dir: Path, pad_ratio: float = 0.35) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for f in out_dir.glob("fig-*.png"):
        f.unlink()
    img = Image.open(png)
    pad = int(pad_ratio * max(1, analysis["text_line_height"]))
    n = 0
    for c in analysis["candidates"]:
        if c["kind"] != "figure":
            continue
        n += 1
        x, y, bw, bh = c["bbox"]
        box = (max(0, x - pad), max(0, y - pad),
               min(analysis["w"], x + bw + pad), min(analysis["h"], y + bh + pad))
        name = f"fig-{n:02d}.png"
        img.crop(box).save(out_dir / name)
        c["file"] = f"figures/{name}"


def prepare(pdf: Path, book_id: str, page: int, page_dir: Path, dpi: int = 300) -> dict:
    page_dir.mkdir(parents=True, exist_ok=True)
    png = render_page(pdf, page, page_dir / "page.png", dpi=dpi)
    analysis = analyse(png)
    crop_figures(png, analysis, page_dir / "figures")
    blocks = {
        "book_id": book_id,
        "page": page,
        "render": {
            "dpi": dpi, "w": analysis["w"], "h": analysis["h"],
            "sha256": sha256_file(png),
        },
        "content_width": analysis["content_width"],
        "text_line_height": analysis["text_line_height"],
        "candidates": analysis["candidates"],
    }
    (page_dir / "blocks.json").write_text(
        json.dumps(blocks, ensure_ascii=False, indent=2), encoding="utf-8")
    return blocks
