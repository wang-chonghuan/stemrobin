#!/usr/bin/env python3
"""Prepare and validate production answer keys for selected lessons."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

SCHEMA = "ld-s10y-answer/lesson-answers@1"
JUDGES = {"exact", "numeric", "expression"}
GRADING = {"auto", "ungraded"}
SOURCES = {"book", "derived", "reviewed"}


def load(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"ERROR: 缺少 {path}")
    except json.JSONDecodeError as error:
        raise SystemExit(f"ERROR: {path} 不是有效 JSON: {error}")


def dump(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def selected_lessons(args: argparse.Namespace) -> list[str]:
    if not args.lesson:
        raise SystemExit("ERROR: 至少指定一个 --lesson")
    if len(args.lesson) != len(set(args.lesson)):
        raise SystemExit("ERROR: --lesson 有重复")
    return args.lesson


def book_dir(args: argparse.Namespace) -> Path:
    return Path(args.root) / args.book


def captured_answers(root: Path) -> dict[int, dict]:
    path = root / "answers.json"
    if not path.exists():
        return {}
    document = load(path)
    return {int(answer["exercise"]): answer for answer in document.get("answers", [])}


def cmd_prepare(args: argparse.Namespace) -> int:
    root = book_dir(args)
    captured = captured_answers(root)
    for lesson in selected_lessons(args):
        lesson_dir = root / "lessons" / lesson
        exercise_doc = load(lesson_dir / "exercises.json")
        answers = []
        for exercise in exercise_doc.get("exercises", []):
            number = int(exercise["number"])
            book_answer = captured.get(number)
            item = {
                "exercise": str(exercise["number"]),
                "prompt": exercise["text"],
                "grading": None,
                "source": "book" if book_answer else "derived",
                "displayAnswer": "",
                "parts": [],
            }
            if book_answer:
                item["bookRaw"] = book_answer["raw"]
            answers.append(item)
        template = {
            "schema": SCHEMA,
            "book": args.book,
            "lesson": lesson,
            "status": "draft",
            "answers": answers,
        }
        target = lesson_dir / "answer-keys.template.json"
        dump(target, template)
        print(f"[prepare] {lesson}: {len(answers)} exercises -> {target}")
    return 0


def validate_lesson(path: Path, exercise_path: Path, book: str, lesson: str) -> tuple[dict, list[str]]:
    document = load(path)
    exercise_doc = load(exercise_path)
    errors: list[str] = []
    expected_numbers = [str(item["number"]) for item in exercise_doc.get("exercises", [])]

    if document.get("schema") != SCHEMA:
        errors.append(f"schema 必须是 {SCHEMA!r}")
    if document.get("book") != book:
        errors.append(f"book 必须是 {book!r}")
    if document.get("lesson") != lesson:
        errors.append(f"lesson 必须是 {lesson!r}")
    answers = document.get("answers")
    if not isinstance(answers, list):
        errors.append("answers 必须是数组")
        answers = []
    numbers = [str(answer.get("exercise")) for answer in answers if isinstance(answer, dict)]
    if numbers != expected_numbers:
        errors.append(
            "answer exercise 顺序或集合与 exercises.json 不一致: "
            f"want={expected_numbers}, got={numbers}"
        )

    for index, answer in enumerate(answers):
        label = f"answers[{index}]"
        if not isinstance(answer, dict):
            errors.append(f"{label} 必须是对象")
            continue
        grading = answer.get("grading")
        source = answer.get("source")
        display = answer.get("displayAnswer")
        parts = answer.get("parts")
        if grading not in GRADING:
            errors.append(f"{label}.grading 必须是 auto 或 ungraded")
        if source not in SOURCES:
            errors.append(f"{label}.source 非法")
        if not isinstance(display, str) or not display.strip():
            errors.append(f"{label}.displayAnswer 不能为空")
        if not isinstance(parts, list):
            errors.append(f"{label}.parts 必须是数组")
            parts = []
        if grading == "ungraded" and parts:
            errors.append(f"{label} ungraded 的 parts 必须为空")
        if grading == "auto" and not parts:
            errors.append(f"{label} auto 至少需要一个 part")
        for part_index, part in enumerate(parts):
            part_label = f"{label}.parts[{part_index}]"
            if not isinstance(part, dict):
                errors.append(f"{part_label} 必须是对象")
                continue
            if part.get("judge") not in JUDGES:
                errors.append(f"{part_label}.judge 非法")
            expected = part.get("expected")
            if (
                not isinstance(expected, list)
                or not expected
                or any(not isinstance(value, str) or not value.strip() for value in expected)
            ):
                errors.append(f"{part_label}.expected 必须是非空字符串数组")
            for optional in ("label", "unit"):
                if optional in part and not isinstance(part[optional], str):
                    errors.append(f"{part_label}.{optional} 必须是字符串")
            tolerance = part.get("tolerance")
            if tolerance is not None and (
                not isinstance(tolerance, (int, float)) or tolerance < 0
            ):
                errors.append(f"{part_label}.tolerance 必须是非负数")
    return document, errors


def cmd_finalize(args: argparse.Namespace) -> int:
    root = book_dir(args)
    failed = False
    for lesson in selected_lessons(args):
        lesson_dir = root / "lessons" / lesson
        path = lesson_dir / "answer-keys.json"
        document, errors = validate_lesson(
            path,
            lesson_dir / "exercises.json",
            args.book,
            lesson,
        )
        if errors:
            failed = True
            for error in errors:
                print(f"ERROR {lesson}: {error}")
            continue
        document["status"] = "ready"
        document["count"] = len(document["answers"])
        dump(path, document)
        auto = sum(answer["grading"] == "auto" for answer in document["answers"])
        ungraded = len(document["answers"]) - auto
        audit = {
            "schema": "ld-s10y-answer/lesson-audit@1",
            "book": args.book,
            "lesson": lesson,
            "status": "pass",
            "answerCount": len(document["answers"]),
            "auto": auto,
            "ungraded": ungraded,
        }
        dump(lesson_dir / "answer-keys.audit.json", audit)
        print(f"[finalize] {lesson}: PASS auto={auto} ungraded={ungraded}")
    return 2 if failed else 0


def add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--book", required=True)
    parser.add_argument("--lesson", action="append")
    parser.add_argument("--root", default="page2class")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lesson_answers.py",
        description="为指定 Soviet 10 Years lesson 生产答案键",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    prepare = subparsers.add_parser("prepare")
    add_common(prepare)
    prepare.set_defaults(handler=cmd_prepare)
    finalize = subparsers.add_parser("finalize")
    add_common(finalize)
    finalize.set_defaults(handler=cmd_finalize)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
