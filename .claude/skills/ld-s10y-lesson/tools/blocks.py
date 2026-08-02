"""page.md 的块格式。

页是扫描的产物，不是内容的单位——真正要交付的是**小节**和**题**，两者都不认页
边界。所以 cap1 的产物不再是"一堆行"，而是**带类型的块**：块知道自己是标题、正文、
第几题还是插图，知道自己是否从上页续来、是否续到下页。跨页装订因此变成纯粹的
拼接，不需要再猜。

    <!-- h3 -->            小节标题（原书的「1. 子集」）
    <!-- p -->             正文段
    <!-- exhead -->        习题栏标题（复习题 / 家庭作业题）
    <!-- ex 20 -->         习题，20 是原书题号
    <!-- fig 图 7 box 790,1640,490,250 -->
    <!-- cap 图 7 -->      印刷出来的图题行（是文字，要能检索）
    <!-- foot -->          页码

块头可带三个标记：`cont`（承接上页同一对象）、`open`（延续到下页）、
`samerow`（本块首行与上一块末行印在同一行上，如正文右侧的图题）。
块体里**一行 = 印刷一行**；印刷把一条公式从中间切开时，公式写完整、断点写 `↵`，
这样行数仍然对得上，公式也配得平。
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HEAD = re.compile(r"^<!--\s+(?P<kind>h1|h2|h3|p|exhead|ex|fig|cap|foot)\b"
                  r"(?P<rest>.*?)\s*-->$")
BOX = re.compile(r"\bbox\s+(\d+,\d+,\d+,\d+)")
FLAG = re.compile(r"\b(cont|open|samerow)\b")
OWNER = re.compile(r"\bowner-ex\s+(\d+)\b")
WRAP = "↵"
KINDS_TEXT = ("h1", "h2", "h3", "p", "exhead", "ex", "cap", "foot")


def fig_id(label: str, page: int, seq: int) -> str:
    """图片文件名。用**原书的图号**，跨页唯一——`图 7` 在哪一页都是 fig-07。

    页内序号（fig-01/02）不行：同一张图的引用可能在邻页，题目里写的是「图 7」。
    没有印刷编号的（课程表这类）才退回按页编号。
    """
    nums = re.findall(r"\d+", label or "")
    if nums:
        return "fig-" + "-".join(n.zfill(2) if i == 0 else n for i, n in enumerate(nums))
    return f"tbl-p{page:04d}-{seq:02d}"


def parse(md: str) -> tuple[dict, list[dict]]:
    if not md.startswith("---"):
        raise ValueError("page.md 缺少 frontmatter")
    _, fm, body = md.split("---", 2)
    meta = json.loads(fm)

    blocks, cur = [], None
    for raw in body.splitlines():
        m = HEAD.match(raw.strip())
        if m:
            # 标签可以带空格（「图 6 之 1）」），所以先把 box 和标记抠掉，剩下的就是标签
            rest = m.group("rest")
            mb = BOX.search(rest)
            box = [int(v) for v in mb.group(1).split(",")] if mb else None
            rest = BOX.sub("", rest)
            mo = OWNER.search(rest)
            owner_exercise = mo.group(1) if mo else None
            rest = OWNER.sub("", rest)
            flags = set(FLAG.findall(rest))
            label = FLAG.sub("", rest).strip() or None
            cur = {"kind": m.group("kind"), "label": label, "box": box,
                   "owner_exercise": owner_exercise,
                   "cont": "cont" in flags, "open": "open" in flags,
                   "samerow": "samerow" in flags, "lines": []}
            blocks.append(cur)
        elif cur is not None and raw.strip():
            if raw.strip().startswith("!["):      # 图片引用由 fig 块的 box 决定，忽略
                continue
            cur["lines"].append(raw.rstrip())
    return meta, blocks


def dump(meta: dict, blocks: list[dict], page: int) -> str:
    out = ["---", json.dumps(meta, ensure_ascii=False, indent=2), "---", ""]
    seq = 0
    for b in blocks:
        head = ["<!--", b["kind"]]
        if b.get("label"):
            head.append(b["label"])
        if b.get("box"):
            head.append("box " + ",".join(map(str, b["box"])))
        if b.get("owner_exercise"):
            head.append("owner-ex " + str(b["owner_exercise"]))
        if b.get("cont"):
            head.append("cont")
        if b.get("open"):
            head.append("open")
        if b.get("samerow"):
            head.append("samerow")
        out.append(" ".join(head) + " -->")
        if b["kind"] == "fig":
            seq += 1
            fid = b.get("id") or fig_id(b.get("label"), page, seq)
            out.append(f"![{b.get('label') or ''}](figures/{fid}.png)")
        out.extend(b["lines"])
        out.append("")
    return "\n".join(out).rstrip() + "\n"


def printed_lines(blocks: list[dict]) -> int:
    """块体一共代表多少印刷行——与行投影数出来的行数对账。"""
    n = 0
    for b in blocks:
        if b["kind"] not in KINDS_TEXT:
            continue
        n += len(b["lines"]) + sum(ln.count(WRAP) for ln in b["lines"])
        # samerow：本块首行与上一块末行印在**同一行**上（正文右侧的图题、并排的图题），
        # 各算一行就会多数一行。
        if b.get("samerow"):
            n -= 1
    return n


def text_of(block: dict, join: str = "") -> str:
    """把块体接成一段文字。印刷换行在中文教材里一律是软换行，直接接上。"""
    return join.join(ln.replace(WRAP, "") for ln in block["lines"]).strip()


def load(path: Path):
    return parse(Path(path).read_text(encoding="utf-8"))
