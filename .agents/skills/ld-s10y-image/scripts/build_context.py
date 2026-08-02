#!/usr/bin/env python3
"""Build authoritative edition-text context for one lesson figure."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
from pathlib import Path


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def png_size(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:24]
    if len(header) < 24 or not header.startswith(PNG_SIGNATURE):
        raise SystemExit(f"ERROR: source figure is not a PNG: {path}")
    return struct.unpack(">II", header[16:24])


def suggested_size(width: int, height: int) -> str:
    ratio = width / height
    if ratio >= 1.2:
        return "1536x1024"
    if ratio <= 0.83:
        return "1024x1536"
    return "1024x1024"


def normalized_reference(text: str) -> str:
    return re.sub(r"\s+", "", text).lower()


def prose_context(blocks: list[dict], figure_id: str) -> list[dict]:
    result = []
    for index, block in enumerate(blocks):
        if block.get("kind") != "fig" or block.get("id") != figure_id:
            continue
        figure_label = block.get("label", "")
        references = {
            normalized_reference(figure_id),
            normalized_reference(figure_label),
        }
        direct = []
        for candidate in blocks:
            if candidate.get("kind") != "p":
                continue
            text = candidate.get("text", "").strip()
            normalized = normalized_reference(text)
            if text and any(reference and reference in normalized for reference in references):
                direct.append(text)
        nearby = []
        for candidate in blocks[max(0, index - 3):index + 4]:
            if candidate.get("kind") in {"p", "cap"}:
                text = candidate.get("text", "").strip()
                if text:
                    nearby.append(text)
        context = list(dict.fromkeys(direct + nearby))
        result.append({
            "figureLabel": figure_label,
            "nearbyText": context,
        })
    return result


def exercise_context(items: list[dict], figure_id: str) -> list[dict]:
    result = []
    for item in items:
        refs = item.get("figure_refs", [])
        figures = [figure.get("id") for figure in item.get("figures", [])]
        if figure_id not in refs and figure_id not in figures:
            continue
        text = item.get("text", "").strip()
        if text:
            result.append({
                "exercise": str(item.get("number")),
                "group": item.get("group"),
                "text": text,
            })
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--book", required=True)
    parser.add_argument("--edition", required=True)
    parser.add_argument("--figure", required=True)
    parser.add_argument("--root", default="resources/s10y-lessons")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    book = Path(args.root) / args.book
    edition = book / "editions" / args.edition
    source_image = book / "figures" / f"{args.figure}.png"
    if not source_image.is_file():
        raise SystemExit(f"ERROR: missing original PNG: {source_image}")

    lessons = []
    lesson_root = edition / "lessons"
    if not lesson_root.is_dir():
        raise SystemExit(f"ERROR: missing edition lessons: {lesson_root}")
    for lesson_dir in sorted(lesson_root.iterdir()):
        if not lesson_dir.is_dir():
            continue
        lesson_path = lesson_dir / "lesson.json"
        exercise_path = lesson_dir / "exercises.json"
        if not lesson_path.is_file() or not exercise_path.is_file():
            continue
        lesson = load(lesson_path)
        exercises = load(exercise_path)
        prose = prose_context(lesson.get("prose", []), args.figure)
        exercise_items = exercise_context(
            exercises.get("exercises", []), args.figure
        )
        if prose or exercise_items:
            lessons.append({
                "lesson": lesson_dir.name,
                "title": lesson.get("printed_title") or lesson.get("title"),
                "prose": prose,
                "exercises": exercise_items,
            })
    if not lessons:
        raise SystemExit(
            f"ERROR: {args.figure} is not referenced by edition {args.edition}"
        )

    width, height = png_size(source_image)
    payload = {
        "schema": "ld-s10y-image/context@1",
        "book": args.book,
        "edition": args.edition,
        "figure": args.figure,
        "authoritativeRule": (
            "Modern-edition text is authoritative. The original PNG supplies "
            "visual structure only. Never use an answer key or derive answer "
            "annotations."
        ),
        "sourceImage": {
            "path": source_image.as_posix(),
            "sha256": sha256(source_image),
            "width": width,
            "height": height,
        },
        "suggestedSize": suggested_size(width, height),
        "lessons": lessons,
    }
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")
        print(args.output)
    else:
        print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
