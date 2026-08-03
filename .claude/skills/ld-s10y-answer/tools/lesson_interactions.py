#!/usr/bin/env python3
"""cap3：为一个 edition lesson 的每道 exercise 产出「交互规格」。

规格回答的是答案键回答不了的那个问题：**这道题该怎么答**。产品端至今把每一个作答框
都渲染成公式编辑器，那是 app 的兜底，不是管线的决定 —— 因为管线从来没被问过。

分工与本技能其余部分一致：**能机械推导的一律机械推导，模型不参与**。推导不出来的题
不许静默兜底，必须写清 `derivation` 与 `needsAuthoring`，让下一轮知道从哪儿下手。

`grid-point` 是这里唯一一个「从图里读出语义」的形态，因此它自带交叉校验：从 FigureSpec
复原出的每个具名点坐标，必须出现在该题答案键的 expected 里，且小问数 = 2 × 具名点数。
校验不过就是失败，拒绝产出 —— 不是警告。

用法:
  lesson_interactions.py prepare  --book 5m --edition modern-us-neutral --lesson <id>...
  lesson_interactions.py finalize --book 5m --edition modern-us-neutral --lesson <id>...
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

SCHEMA = "ld-s10y-answer/lesson-interactions@1"

# v1 词汇表。只有前三个允许机械推导；后三个只能被标记为待补 —— 产品端还没有消费它们，
# 现在就定死选项形状等于凭空猜。
WIDGETS = {"number", "math", "grid-point", "choice-one", "choice-many", "free"}
DERIVABLE = {"number", "math", "grid-point", "free"}

PLAIN_NUMBER = re.compile(r"^-?\d+(?:[.,]\d+)?$")
# 具名点的标签：单个拉丁大写字母（原书用 A/B/C/K/M/N/O/P…）
POINT_NAME = re.compile(r"^[A-Z]$")


def die(msg: str) -> None:
    print(f"lesson_interactions: {msg}", file=sys.stderr)
    sys.exit(1)


def load(path: Path):
    if not path.exists():
        die(f"缺少文件 {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def part_label(part: dict) -> str | None:
    """小问名在语料里有两种写法：文档规定的 label 与更早的 id。两者语义相同。"""
    for key in ("label", "id"):
        value = part.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def is_plain_number(value) -> bool:
    return isinstance(value, str) and bool(PLAIN_NUMBER.match(value.strip()))


# --- FigureSpec → 语义坐标系 ------------------------------------------------
# FigureSpec 是渲染规格，不是几何规格：网格是 21 条独立线段，刻度是散落的文字，没有一处
# 声明过原点和单位。所以这里从图元反推，并且只在反推自洽时才承认它是一个坐标系。


def _axis_from_ticks(ticks: list[tuple[float, float]]) -> tuple[float, float, list[str]] | None:
    """ticks = [(刻度值, 像素坐标)]。返回 (值为 0 处的像素, 每一格的像素, 偏离的刻度)。

    坐标系是**假说**，不是结论 —— 真正的判据是后面拿答案键做的交叉校验。所以这里用中位数
    稳健拟合，而不是要求每个刻度都完美等距：一个画歪的刻度标签不该让整张图不可用。但偏离
    的刻度必须被记下来（`frameWarnings`），因为那是图本身的缺陷，静默吞掉就没人会去修。

    值为 0 的刻度标签按印刷惯例是**挪到原点旁边**而不是压在原点上的，所以它不参与拟合。
    """
    usable = [(value, pixel) for value, pixel in ticks if value != 0]
    if len(usable) < 3:
        return None
    usable.sort()
    spans = sorted(
        (usable[i + 1][1] - usable[i][1]) / (usable[i + 1][0] - usable[i][0])
        for i in range(len(usable) - 1)
    )
    unit = spans[len(spans) // 2]
    if abs(unit) < 1e-6:
        return None
    zeros = sorted(pixel - value * unit for value, pixel in usable)
    zero = zeros[len(zeros) // 2]
    tolerance = abs(unit) * 0.05
    warnings = [
        f"刻度 {value:g} 落在 {pixel:g}，等距应为 {zero + value * unit:g}"
        for value, pixel in usable
        if abs(zero + value * unit - pixel) > tolerance
    ]
    return zero, unit, warnings


def recover_frame(spec: dict) -> dict | None:
    """从一份 deterministic FigureSpec 里复原直角坐标系与具名点。

    返回 {"origin": [x0,y0], "unit": [ux,uy], "points": {"M": [3,5], ...}} 或 None。
    """
    if spec.get("mode") != "deterministic":
        return None
    objects = spec.get("objects") or []
    texts = [o for o in objects if o.get("type") == "text" and isinstance(o.get("at"), list)]
    points = [o for o in objects if o.get("type") == "point" and isinstance(o.get("at"), list)]
    if not points:
        return None

    numeric = [t for t in texts if PLAIN_NUMBER.match(str(t.get("text", "")).strip())]
    if len(numeric) < 6:
        return None

    # 刻度沿轴排成一行/一列：同一条轴上的刻度共享另一个坐标分量。
    def band(items, fixed_index):
        groups: dict[float, list] = {}
        for item in items:
            key = round(item["at"][fixed_index], 1)
            groups.setdefault(key, []).append(item)
        if not groups:
            return []
        return max(groups.values(), key=len)

    x_ticks_raw = band(numeric, 1)  # 共享 y → 横轴刻度
    y_ticks_raw = band(numeric, 0)  # 共享 x → 纵轴刻度
    x_axis = _axis_from_ticks(
        [(float(t["text"]), float(t["at"][0])) for t in x_ticks_raw]
    )
    y_axis = _axis_from_ticks(
        [(float(t["text"]), float(t["at"][1])) for t in y_ticks_raw]
    )
    if not x_axis or not y_axis:
        return None
    x_zero, x_unit, x_warnings = x_axis
    y_zero, y_unit, y_warnings = y_axis

    # 具名点：与某个 point 位置重合的单字母文字就是它的名字。
    named: dict[str, list[float]] = {}
    for point in points:
        px, py = float(point["at"][0]), float(point["at"][1])
        label = None
        for text in texts:
            if not POINT_NAME.match(str(text.get("text", "")).strip()):
                continue
            tx, ty = float(text["at"][0]), float(text["at"][1])
            if abs(tx - px) < 1e-6 and abs(ty - py) < 1e-6:
                label = str(text["text"]).strip()
                break
        if not label:
            continue
        gx = (px - x_zero) / x_unit
        gy = (py - y_zero) / y_unit
        # 只承认落在格点上的点；半格的点不是这个坐标系能表达的。
        if abs(gx - round(gx)) > 0.2 or abs(gy - round(gy)) > 0.2:
            return None
        named[label] = [round(gx), round(gy)]

    if len(named) < 2:
        return None
    return {
        "origin": [round(x_zero, 3), round(y_zero, 3)],
        "unit": [round(x_unit, 3), round(y_unit, 3)],
        "points": named,
        "warnings": [f"x: {w}" for w in x_warnings] + [f"y: {w}" for w in y_warnings],
    }


# --- 推导 -------------------------------------------------------------------


def derive(exercise: dict, answer: dict, figures: dict, spec_dir: Path) -> dict:
    """一道题 → 一条规格。纯函数式的判据，没有一处是猜的。"""
    number = str(exercise.get("number"))
    grading = answer.get("grading")
    parts = answer.get("parts") or []

    def spec(widget: str, derivation: str, **extra) -> dict:
        out = {"exercise": number, "widget": widget, "derivation": derivation}
        out.update(extra)
        return out

    if grading == "ungraded":
        return spec("free", "grading=ungraded：无判据可自动判分，保留自由作答")

    if not parts:
        return spec(
            "math",
            "grading=auto 但没有 parts：答案键不完整，维持现状",
            needsAuthoring="答案键缺少 parts，无法确定小问数",
        )

    judges = {p.get("judge") for p in parts}

    if "expression" in judges:
        return spec("math", "含 judge=expression 的小问：只有公式编辑器能表达")

    if judges == {"numeric"} and all(
        all(is_plain_number(v) for v in (p.get("expected") or [])) for p in parts
    ):
        grid = try_grid_point(exercise, parts, figures, spec_dir)
        if grid:
            return spec("grid-point", grid.pop("derivation"), **grid)
        return spec(
            "number",
            "全部小问 judge=numeric 且 expected 均为普通数字",
            parts=[
                {
                    **({"label": part_label(p)} if part_label(p) else {}),
                    **({"unit": p["unit"]} if isinstance(p.get("unit"), str) else {}),
                }
                for p in parts
            ],
        )

    if judges == {"exact"}:
        return spec(
            "math",
            "全部小问 judge=exact：正确形态多半是点选或多选，但选项形状需要人或模型来定",
            needsAuthoring="待补 choice-one / choice-many 的选项",
        )

    return spec(
        "math",
        f"混合判据 {sorted(j for j in judges if j)}：无单一形态可推",
        needsAuthoring="需要逐小问拆分形态",
    )


def try_grid_point(exercise, parts, figures, spec_dir: Path) -> dict | None:
    """这道题是不是「在坐标网格上读点」？是的话连交叉校验一起做。"""
    refs = exercise.get("figureRefs") or exercise.get("figure_refs") or []
    if len(refs) != 1:
        return None
    figure = figures.get(refs[0])
    if not figure or not figure.get("spec"):
        return None
    spec_path = spec_dir / Path(figure["spec"]).name
    if not spec_path.exists():
        return None
    frame = recover_frame(load(spec_path))
    if not frame:
        return None

    named = {k: v for k, v in frame["points"].items() if v != [0, 0]}
    if not named or len(parts) != 2 * len(named):
        return None

    # 交叉校验：复原出的每个坐标都必须出现在答案键的 expected 里。这是这条推导路径
    # 的唯一凭据 —— 推错了当场就被答案键抓住。
    expected: list[str] = []
    for p in parts:
        expected.extend(str(v).strip() for v in (p.get("expected") or []))
    for name, (gx, gy) in named.items():
        for coordinate in (gx, gy):
            if str(coordinate) not in expected:
                return None

    out = {
        "derivation": (
            f"引用的 {refs[0]} 是 deterministic 图，复原出直角坐标系与 {len(named)} 个具名点；"
            f"小问数 {len(parts)} = 2 × {len(named)}，且每个复原坐标都出现在答案键的 expected 中"
        ),
        "figure": refs[0],
        "frame": {"origin": frame["origin"], "unit": frame["unit"]},
        "points": named,
    }
    if frame["warnings"]:
        # 交叉校验已经过了，所以坐标系是对的 —— 但图上有刻度没画在等距位置上。
        # 记下来，让它成为 ld-s10y-image 的下一张单子，而不是消失。
        out["frameWarnings"] = frame["warnings"]
    return out


# --- 命令 -------------------------------------------------------------------


def lesson_dir(book: str, edition: str, lesson: str) -> Path:
    return Path("resources/s10y-lessons") / book / "editions" / edition / "lessons" / lesson


def build(book: str, edition: str, lesson: str) -> dict:
    base = lesson_dir(book, edition, lesson)
    exercises = load(base / "exercises.json")["exercises"]
    answers = {str(a["exercise"]): a for a in load(base / "answer-keys.json")["answers"]}
    figures_doc = load(base / "figures.json")
    figures = {f["id"]: f for f in figures_doc.get("figures", [])}
    spec_dir = Path("resources/s10y-lessons") / book / "editions" / edition / "figures"

    interactions = []
    for exercise in exercises:
        number = str(exercise["number"])
        answer = answers.get(number)
        if answer is None:
            die(f"{lesson} 第 {number} 题没有答案键：规格必须与答案键逐题一一对应")
        interactions.append(derive(exercise, answer, figures, spec_dir))

    return {
        "schema": SCHEMA,
        "book": book,
        "lesson": lesson,
        "edition": edition,
        "status": "draft",
        "count": len(interactions),
        "interactions": interactions,
    }


def validate(doc: dict, book: str, edition: str, lesson: str) -> list[str]:
    errors: list[str] = []
    base = lesson_dir(book, edition, lesson)
    exercises = load(base / "exercises.json")["exercises"]
    answers = {str(a["exercise"]): a for a in load(base / "answer-keys.json")["answers"]}
    spec_dir = Path("resources/s10y-lessons") / book / "editions" / edition / "figures"
    figures = {f["id"]: f for f in load(base / "figures.json").get("figures", [])}

    if doc.get("schema") != SCHEMA:
        errors.append(f"schema 必须是 {SCHEMA}")
    numbers = [str(e["number"]) for e in exercises]
    got = [str(i.get("exercise")) for i in doc.get("interactions", [])]
    if got != numbers:
        errors.append(f"规格必须与题目一一对应且同序：期望 {len(numbers)} 条，得到 {len(got)} 条")

    by_number = {str(e["number"]): e for e in exercises}
    for item in doc.get("interactions", []):
        number = str(item.get("exercise"))
        widget = item.get("widget")
        if widget not in WIDGETS:
            errors.append(f"第 {number} 题：未知 widget {widget!r}")
            continue
        if not item.get("derivation"):
            errors.append(f"第 {number} 题：缺少 derivation，不允许无据的规格")
        if widget not in DERIVABLE and not item.get("needsAuthoring"):
            errors.append(f"第 {number} 题：{widget} 尚不能机械推导，必须标记 needsAuthoring")
        # 交叉校验：grid-point 必须能被独立重算出来，且与答案键不矛盾。
        if widget == "grid-point":
            answer = answers.get(number) or {}
            recomputed = try_grid_point(
                by_number[number], answer.get("parts") or [], figures, spec_dir
            )
            if not recomputed:
                errors.append(
                    f"第 {number} 题：grid-point 交叉校验失败 —— "
                    f"从 FigureSpec 复原的坐标系/具名点与答案键的 expected 对不上"
                )
                continue
            if recomputed["points"] != item.get("points"):
                errors.append(
                    f"第 {number} 题：grid-point 的 points 与从 FigureSpec 复原的不一致"
                )
    return errors


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["prepare", "finalize"])
    parser.add_argument("--book", required=True)
    parser.add_argument("--edition", required=True)
    parser.add_argument("--lesson", action="append", required=True)
    args = parser.parse_args()

    failed = False
    for lesson in args.lesson:
        out = lesson_dir(args.book, args.edition, lesson) / "interactions.json"
        if args.command == "prepare":
            doc = build(args.book, args.edition, lesson)
            out.write_text(
                json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
            )
            counts: dict[str, int] = {}
            for item in doc["interactions"]:
                counts[item["widget"]] = counts.get(item["widget"], 0) + 1
            pending = sum(1 for i in doc["interactions"] if i.get("needsAuthoring"))
            print(f"{lesson}: {doc['count']} 条 → {counts}，待补 {pending} 条 → {out}")
        else:
            doc = load(out)
            errors = validate(doc, args.book, args.edition, lesson)
            if errors:
                failed = True
                print(f"{lesson}: 校验失败", file=sys.stderr)
                for error in errors:
                    print(f"  - {error}", file=sys.stderr)
                continue
            doc["status"] = "ready"
            out.write_text(
                json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
            )
            print(f"{lesson}: 校验通过，status=ready")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
