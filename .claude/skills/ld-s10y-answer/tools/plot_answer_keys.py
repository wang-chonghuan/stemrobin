#!/usr/bin/env python3
"""把「作坐标系并标出下列各点」这类题的答案键补齐。

这不是求解：目标坐标就印在题面里。所以这里做的是**转写** —— 从题面正则提取
`NAME(x, y)`，按点序展开成 2N 个 numeric 小问（先横后纵），与 `grid-plot` 规格的顺序
约定一致。`source` 保持 `derived`，`notes` 写明依据是题面转写而非求解。

只处理调用者点名的 exercise；已经是 `auto` 的题不动。

用法:
  plot_answer_keys.py --book 5m --edition modern-us-neutral --lesson <id> --exercise <n>...
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

PAIR = re.compile(r"([A-Z])\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--book", required=True)
    parser.add_argument("--edition", required=True)
    parser.add_argument("--lesson", required=True)
    parser.add_argument("--exercise", action="append", required=True)
    args = parser.parse_args()

    base = (
        Path("resources/s10y-lessons")
        / args.book
        / "editions"
        / args.edition
        / "lessons"
        / args.lesson
    )
    exercises = {
        str(e["number"]): e
        for e in json.loads((base / "exercises.json").read_text(encoding="utf-8"))["exercises"]
    }
    doc = json.loads((base / "answer-keys.json").read_text(encoding="utf-8"))

    for number in args.exercise:
        answer = next(
            (a for a in doc["answers"] if str(a["exercise"]) == number), None
        )
        if answer is None:
            print(f"第 {number} 题没有答案键条目", file=sys.stderr)
            sys.exit(1)
        if answer.get("grading") == "auto":
            print(f"第 {number} 题已经是 auto，跳过")
            continue
        pairs = PAIR.findall(exercises[number]["text"])
        if not pairs:
            print(f"第 {number} 题的题面里没有 NAME(x,y) 形式的坐标", file=sys.stderr)
            sys.exit(1)
        seen: set[str] = set()
        points: list[tuple[str, str, str]] = []
        for name, x, y in pairs:
            if name in seen:
                continue
            seen.add(name)
            points.append((name, x, y))
        parts = []
        for name, x, y in points:
            parts.append({"label": f"{name} 横坐标", "judge": "numeric", "expected": [x]})
            parts.append({"label": f"{name} 纵坐标", "judge": "numeric", "expected": [y]})
        answer["grading"] = "auto"
        answer["parts"] = parts
        answer["notes"] = (
            "目标坐标直接印在题面里，本条答案键是对题面的转写而非求解："
            f"按点序展开为 {len(points)} 个点 × 2 = {len(parts)} 个小问，先横后纵。"
        )
        print(
            f"#{number}: {len(points)} 个点 → {len(parts)} 个小问；"
            + "，".join(f"{n}({x},{y})" for n, x, y in points)
        )

    (base / "answer-keys.json").write_text(
        json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    print("answer-keys.json 已更新")


if __name__ == "__main__":
    main()
