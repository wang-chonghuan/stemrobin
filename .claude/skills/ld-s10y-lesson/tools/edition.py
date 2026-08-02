#!/usr/bin/env python3
"""Prepare and validate culturally modernized lesson editions."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image


LESSON_SCHEMA = "ld-s10y-lesson/edition-lesson@1"
EXERCISES_SCHEMA = "ld-s10y-lesson/edition-exercises@1"
FIGURES_SCHEMA = "ld-s10y-lesson/edition-figures@1"
FIGURE_SPEC_SCHEMA = "ld-s10y-lesson/figure-spec@1"
IMAGE_FIGURE_SPEC_SCHEMA = "ld-s10y-image/figure-spec@1"
AUDIT_SCHEMA = "ld-s10y-lesson/edition-audit@1"
BOOK_SCHEMA = "ld-s10y-lesson/edition-book@1"
MATH = re.compile(r"\$\$(.+?)\$\$|\$([^$]+?)\$", re.S)
NUMBER = re.compile(r"(?<![\w.])-?\d+(?:\.\d+)?(?![\w.])")
NUMBERED_PART = re.compile(r"(?<![A-Za-z0-9_.])(\d{1,2})[)）]")
CYRILLIC = re.compile(r"[\u0400-\u04ff]")
NON_ENGLISH_FIGURE_SCRIPT = re.compile(
    r"[\u0400-\u04ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]"
)
GRAPHIC_TAGS = {
    "path", "line", "polyline", "polygon", "rect", "circle", "ellipse", "text",
}
IDENTITY_FIELDS = (
    "id", "card_id", "chapter", "section", "number", "title", "printed_title",
    "start_page", "start_printed", "exercise_count",
)


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


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def selected_lessons(args: argparse.Namespace) -> list[str]:
    if not args.lesson:
        raise SystemExit("ERROR: 至少指定一个 --lesson")
    if len(args.lesson) != len(set(args.lesson)):
        raise SystemExit("ERROR: --lesson 有重复")
    return args.lesson


def source_ref(book: Path, path: Path) -> dict:
    return {
        "path": path.relative_to(book).as_posix(),
        "sha256": sha256(path),
        "data": load(path),
    }


def edition_dir(args: argparse.Namespace) -> Path:
    return Path(args.root) / args.book / "editions" / args.edition


def source_dir(args: argparse.Namespace) -> Path:
    return Path(args.root) / args.book


def modern_prose(source: dict) -> list[dict]:
    return [
        {
            **copy.deepcopy(block),
            "source_text": block.get("text", ""),
            "changes": [],
            "numeric_changes": [],
        }
        for block in source.get("prose", [])
    ]


def modern_exercises(source: dict) -> list[dict]:
    result = []
    for exercise in source.get("exercises", []):
        source_text = exercise.get("text", "")
        modern_text = normalize_numbered_subparts(source_text)
        result.append({
            **copy.deepcopy(exercise),
            "text": modern_text,
            "lines": modern_text.splitlines(),
            "source_text": source_text,
            "changes": ["layout"] if modern_text != source_text else [],
            "numeric_changes": [],
        })
    return result


def figure_sources(book: Path, figures: list[dict]) -> list[dict]:
    result = []
    for figure in figures:
        item = {
            "id": figure["id"],
            "label": figure.get("label"),
            "spec": f"figures/{figure['id']}.spec.json",
            "changes": ["modernized"],
            "source": {},
        }
        for suffix in (".png", ".svg"):
            path = book / "figures" / f"{figure['id']}{suffix}"
            if path.exists():
                item["source"][suffix[1:]] = {
                    "path": path.relative_to(book).as_posix(),
                    "sha256": sha256(path),
                }
        result.append(item)
    return result


def cmd_prepare(args: argparse.Namespace) -> int:
    book = source_dir(args)
    edition = edition_dir(args)
    profile_path = Path(args.profile)
    profile = load(profile_path)
    book_index = edition / "book.json"
    existing_lessons = load(book_index).get("lessons", []) if book_index.exists() else []
    dump(book_index, {
        "schema": BOOK_SCHEMA,
        "edition": args.edition,
        "status": "draft",
        "profile": {
            "id": profile["id"],
            "path": profile_path.as_posix(),
            "sha256": sha256(profile_path),
        },
        "lessons": existing_lessons,
    })

    for lesson_id in selected_lessons(args):
        raw_dir = book / "lessons" / lesson_id
        lesson_path = raw_dir / "lesson.json"
        exercises_path = raw_dir / "exercises.json"
        lesson_source = source_ref(book, lesson_path)
        exercises_source = source_ref(book, exercises_path)
        raw_lesson = lesson_source["data"]
        raw_exercises = exercises_source["data"]
        target = edition / "lessons" / lesson_id

        lesson_template = {
            **copy.deepcopy(raw_lesson),
            "schema": LESSON_SCHEMA,
            "edition": args.edition,
            "status": "draft",
            "source": lesson_source,
            "prose": modern_prose(raw_lesson),
        }
        exercises_template = {
            **copy.deepcopy(raw_exercises),
            "schema": EXERCISES_SCHEMA,
            "edition": args.edition,
            "status": "draft",
            "source": exercises_source,
            "exercises": modern_exercises(raw_exercises),
        }
        figures_template = {
            "schema": FIGURES_SCHEMA,
            "edition": args.edition,
            "lesson": lesson_id,
            "status": "draft",
            "figures": figure_sources(book, raw_lesson.get("figures", [])),
        }
        for name, value in (
            ("lesson.template.json", lesson_template),
            ("exercises.template.json", exercises_template),
            ("figures.template.json", figures_template),
        ):
            path = target / name
            if path.exists() and not args.force:
                raise SystemExit(f"ERROR: {path} 已存在；确认重建模板时加 --force")
            dump(path, value)
        print(
            f"[adapt-prepare] {lesson_id}: "
            f"正文 {len(raw_lesson.get('prose', []))} 块, "
            f"题 {len(raw_exercises.get('exercises', []))} 道, "
            f"图 {len(raw_lesson.get('figures', []))} 张"
        )
    return 0


def math_signature(text: str) -> list[str]:
    return [(match.group(1) or match.group(2)).strip() for match in MATH.finditer(text)]


def number_signature(text: str) -> list[str]:
    without_math = MATH.sub("", text)
    return NUMBER.findall(without_math)


def normalize_numbered_subparts(text: str) -> str:
    """Sort a complete 1)..N) sequence and put every subpart on its own line."""
    if not isinstance(text, str):
        return text
    masked = list(text)
    for match in MATH.finditer(text):
        masked[match.start():match.end()] = " " * (match.end() - match.start())
    masked_text = "".join(masked)
    depths = []
    depth = 0
    for char in masked_text:
        depths.append(depth)
        if char in "(（":
            depth += 1
        elif char in ")）":
            depth = max(0, depth - 1)
    markers = [
        marker
        for marker in NUMBERED_PART.finditer(masked_text)
        if depths[marker.start()] == 0
        and not re.search(r"图\s*$", masked_text[max(0, marker.start() - 3):marker.start()])
    ]
    if len(markers) < 2:
        return text
    numbers = [int(marker.group(1)) for marker in markers]
    if len(numbers) != len(set(numbers)) or sorted(numbers) != list(range(1, len(numbers) + 1)):
        return text

    prefix = text[:markers[0].start()].rstrip()
    parts = []
    for index, marker in enumerate(markers):
        end = markers[index + 1].start() if index + 1 < len(markers) else len(text)
        part = text[marker.start():end]
        part = re.sub(r"[\t \u3000]+", " ", part).strip()
        parts.append((int(marker.group(1)), part))
    ordered = [part for _, part in sorted(parts)]
    return "\n".join(([prefix] if prefix else []) + ordered)


def validate_numbered_subpart_layout(text: object) -> list[str]:
    if not isinstance(text, str):
        return []
    if normalize_numbered_subparts(text) != text:
        return ["完整数字分题必须按 1 到 N 排序，并且每个分题独占一行"]
    return []


def normalize_exercise_layout(exercises: dict) -> None:
    for exercise in exercises.get("exercises", []):
        text = exercise.get("text")
        normalized = normalize_numbered_subparts(text)
        if normalized == text:
            continue
        exercise["text"] = normalized
        exercise["lines"] = normalized.splitlines()
        changes = exercise.get("changes")
        if isinstance(changes, list) and "layout" not in changes:
            changes.append("layout")


def validate_text(
    source: str,
    modern: object,
    changes: object,
    numeric_changes: object,
    label: str,
    forbidden_terms: list[str],
) -> list[str]:
    errors = []
    if not isinstance(modern, str):
        return [f"{label}.text 必须是字符串"]
    if not isinstance(changes, list) or any(not isinstance(item, str) for item in changes):
        errors.append(f"{label}.changes 必须是字符串数组")
        changes = []
    if modern != source and not changes:
        errors.append(f"{label} 已改写但 changes 为空")
    if modern == source and changes:
        errors.append(f"{label} 未改写但 changes 非空")
    canonical_source = normalize_numbered_subparts(source)
    canonical_modern = normalize_numbered_subparts(modern)
    if math_signature(canonical_modern) != math_signature(canonical_source):
        errors.append(f"{label} 的数学公式发生变化")
    source_numbers = number_signature(canonical_source)
    modern_numbers = number_signature(canonical_modern)
    if not isinstance(numeric_changes, list):
        errors.append(f"{label}.numeric_changes 必须是数组")
        numeric_changes = []
    expected_numbers = source_numbers[:]
    for index, change in enumerate(numeric_changes):
        change_label = f"{label}.numeric_changes[{index}]"
        if not isinstance(change, dict):
            errors.append(f"{change_label} 必须是对象")
            continue
        before = str(change.get("from", ""))
        after = str(change.get("to", ""))
        reason = change.get("reason")
        if not before or not after or not isinstance(reason, str) or not reason.strip():
            errors.append(f"{change_label} 必须包含 from、to 和 reason")
            continue
        try:
            position = expected_numbers.index(before)
        except ValueError:
            errors.append(f"{change_label}.from={before!r} 不在原文剩余数字中")
            continue
        expected_numbers[position] = after
    if modern_numbers != expected_numbers:
        errors.append(
            f"{label} 的非公式数字变化未被准确声明: "
            f"want={expected_numbers}, got={modern_numbers}"
        )
    if numeric_changes and "context-number" not in changes:
        errors.append(f"{label} 有 numeric_changes，但 changes 缺 context-number")
    if CYRILLIC.search(modern):
        errors.append(f"{label} 仍含西里尔字母")
    hits = [term for term in forbidden_terms if term in modern]
    if hits:
        errors.append(f"{label} 仍含旧文化词或俄文人名: {', '.join(hits)}")
    return errors


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def validate_figure_spec(
    spec_path: Path,
    figure_id: str,
    require_review: bool,
    legacy_require_review: bool = True,
) -> tuple[dict, list[str]]:
    if not spec_path.exists():
        return {}, [f"缺少 figure spec: {spec_path}"]
    spec = load(spec_path)
    errors = []
    if spec.get("id") != figure_id:
        errors.append(f"{spec_path}: id 与 figure 不一致")
    schema = spec.get("schema")
    if schema == IMAGE_FIGURE_SPEC_SCHEMA:
        repo = Path(__file__).resolve().parents[4]
        validator = (
            repo
            / ".agents"
            / "skills"
            / "ld-s10y-image"
            / "scripts"
            / "validate_spec.py"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(validator),
                str(spec_path),
                "--stage",
                "approved" if require_review else "draft",
                "--json",
            ],
            cwd=repo,
            capture_output=True,
            text=True,
            check=False,
        )
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError:
            errors.append(
                f"{spec_path}: ld-s10y-image validator 输出异常: "
                f"{(result.stderr or result.stdout).strip()[:300]}"
            )
        else:
            errors += [
                f"{spec_path}: {error}"
                for error in payload.get("errors", [])
            ]
        return spec, errors
    if schema != FIGURE_SPEC_SCHEMA:
        errors.append(
            f"{spec_path}: schema 必须是 {IMAGE_FIGURE_SPEC_SCHEMA}"
        )
        return spec, errors
    if not isinstance(spec.get("description"), str) or not spec["description"].strip():
        errors.append(f"{spec_path}: description 不能为空")
    if not isinstance(spec.get("constraints"), list):
        errors.append(f"{spec_path}: constraints 必须是数组")
    if require_review and legacy_require_review:
        review = spec.get("visualReview")
        if not isinstance(review, dict) or review.get("status") != "pass":
            errors.append(f"{spec_path}: visualReview.status 必须是 pass")
    return spec, errors


def validate_svg(
    path: Path,
    spec_path: Path,
    figure: dict,
    figure_text_language: str | None = None,
    metadata_path: Path | None = None,
) -> list[str]:
    errors = []
    if not path.exists():
        return [f"缺少现代 SVG: {path}"]
    if not spec_path.exists():
        return [f"缺少 SVG spec: {spec_path}"]
    text = path.read_text(encoding="utf-8")
    link_scan = re.sub(r'\sxmlns(?::\w+)?="[^"]+"', "", text)
    if "data:" in link_scan or "http://" in link_scan or "https://" in link_scan:
        errors.append(f"{path}: 禁止 data URI 或外链")
    try:
        root = ET.fromstring(text)
    except ET.ParseError as error:
        return [f"{path}: SVG XML 无效: {error}"]
    if local_name(root.tag) != "svg":
        errors.append(f"{path}: 根节点必须是 svg")
    if not root.get("viewBox"):
        errors.append(f"{path}: 缺 viewBox")
    tags = [local_name(node.tag) for node in root.iter()]
    banned = sorted(set(tags) & {"image", "foreignObject", "script"})
    if banned:
        errors.append(f"{path}: 禁止节点 {banned}")
    if not (set(tags) & GRAPHIC_TAGS):
        errors.append(f"{path}: 没有可见矢量图元")
    if figure_text_language == "English":
        for node in root.iter():
            if local_name(node.tag) not in {"text", "title", "desc"}:
                continue
            value = "".join(node.itertext()).strip()
            if NON_ENGLISH_FIGURE_SCRIPT.search(value):
                errors.append(
                    f"{path}: {local_name(node.tag)} 必须使用英文，发现 {value!r}"
                )
    spec, spec_errors = validate_figure_spec(
        spec_path,
        figure["id"],
        require_review=True,
        legacy_require_review=False,
    )
    errors += spec_errors
    if (
        spec.get("schema") == IMAGE_FIGURE_SPEC_SCHEMA
        and spec.get("mode") != "deterministic"
    ):
        errors.append(f"{spec_path}: SVG 只允许 deterministic mode")
    if (
        spec.get("schema") == IMAGE_FIGURE_SPEC_SCHEMA
        and spec.get("mode") == "deterministic"
    ):
        if metadata_path is None or not metadata_path.exists():
            errors.append(f"{path}: 缺 JSXGraph 渲染报告")
        else:
            metadata = load(metadata_path)
            if metadata.get("schema") != "ld-s10y-image/render@1":
                errors.append(f"{metadata_path}: render schema 非法")
            if metadata.get("mode") != "deterministic":
                errors.append(f"{metadata_path}: mode 必须是 deterministic")
            if metadata.get("renderer", {}).get("name") != "JSXGraph":
                errors.append(f"{metadata_path}: renderer 必须是 JSXGraph")
            if metadata.get("status") != "pass":
                errors.append(f"{metadata_path}: render status 必须是 pass")
            if metadata.get("output", {}).get("svg", {}).get("sha256") != sha256(path):
                errors.append(f"{metadata_path}: output SVG SHA 不一致")
            if metadata.get("spec", {}).get("sha256") != sha256(spec_path):
                errors.append(f"{metadata_path}: FigureSpec SHA 不一致")
    return errors


def validate_png(
    path: Path,
    metadata_path: Path,
    spec_path: Path,
    figure: dict,
) -> list[str]:
    errors = []
    if not path.exists():
        return [f"缺少现代 PNG: {path}"]
    if not metadata_path.exists():
        errors.append(f"缺少 PNG 生成元数据: {metadata_path}")
    if not spec_path.exists():
        errors.append(f"缺少 PNG spec: {spec_path}")
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            if image.format != "PNG":
                errors.append(f"{path}: 必须是 PNG")
            width, height = image.size
            if width < 768 or height < 768:
                errors.append(f"{path}: 分辨率过低 {width}x{height}")
            sample = image.convert("RGB")
            sample.thumbnail((128, 128))
            pixels = list(sample.get_flattened_data())
            nonwhite = [pixel for pixel in pixels if min(pixel) < 245]
            colorful = [
                pixel for pixel in nonwhite
                if max(pixel) - min(pixel) >= 18
            ]
            if not nonwhite or len(colorful) / len(nonwhite) < 0.01:
                errors.append(f"{path}: 图像近似黑白，必须是完整彩色图")
    except (OSError, ValueError) as error:
        errors.append(f"{path}: PNG 无效: {error}")

    spec, spec_errors = validate_figure_spec(
        spec_path,
        figure["id"],
        require_review=True,
    )
    errors += spec_errors
    if metadata_path.exists():
        metadata = load(metadata_path)
        if spec.get("schema") == IMAGE_FIGURE_SPEC_SCHEMA:
            mode = spec.get("mode")
            if mode == "generated":
                if metadata.get("schema") != "n-azure/image-generation@1":
                    errors.append(f"{metadata_path}: generated mode 必须使用 n-azure 元数据")
                if metadata.get("model") != "gpt-image-2":
                    errors.append(f"{metadata_path}: model 必须是 gpt-image-2")
                if metadata.get("mode") != "edit":
                    errors.append(f"{metadata_path}: 必须通过 image edit 读取原图")
                references = metadata.get("references")
                expected_source = figure.get("source", {}).get("png", {}).get("sha256")
                reference_shas = {
                    item.get("sha256")
                    for item in references
                    if isinstance(item, dict)
                } if isinstance(references, list) else set()
                if not expected_source or expected_source not in reference_shas:
                    errors.append(f"{metadata_path}: 未记录当前原图 PNG SHA")
                if metadata.get("output", {}).get("sha256") != sha256(path):
                    errors.append(f"{metadata_path}: output SHA 与 PNG 不一致")
                if (
                    not isinstance(metadata.get("prompt"), str)
                    or not metadata["prompt"].strip()
                ):
                    errors.append(f"{metadata_path}: prompt 不能为空")
            elif mode == "hybrid":
                if metadata.get("schema") != "ld-s10y-image/render@1":
                    errors.append(f"{metadata_path}: hybrid mode 缺 JSXGraph 渲染报告")
                if metadata.get("mode") != "hybrid":
                    errors.append(f"{metadata_path}: mode 必须是 hybrid")
                if metadata.get("renderer", {}).get("name") != "JSXGraph":
                    errors.append(f"{metadata_path}: renderer 必须是 JSXGraph")
                if metadata.get("status") != "pass":
                    errors.append(f"{metadata_path}: render status 必须是 pass")
                expected_image_ids = [
                    item.get("id")
                    for item in spec.get("objects", [])
                    if isinstance(item, dict) and item.get("type") == "image"
                ]
                image_fits = metadata.get("imageFits")
                if not isinstance(image_fits, list):
                    errors.append(f"{metadata_path}: 缺少 hybrid 图片比例保护报告")
                else:
                    reported = {
                        item.get("id"): item
                        for item in image_fits
                        if isinstance(item, dict) and isinstance(item.get("id"), str)
                    }
                    if set(reported) != set(expected_image_ids):
                        errors.append(f"{metadata_path}: imageFits 与 FigureSpec 图片对象不一致")
                    for image_id in expected_image_ids:
                        fit = reported.get(image_id, {})
                        if (
                            fit.get("status") != "pass"
                            or fit.get("preserveAspectRatio") != "xMidYMid meet"
                        ):
                            errors.append(
                                f"{metadata_path}: {image_id} 未通过图片比例保护"
                            )
                if metadata.get("output", {}).get("png", {}).get("sha256") != sha256(path):
                    errors.append(f"{metadata_path}: output PNG SHA 不一致")
                if metadata.get("spec", {}).get("sha256") != sha256(spec_path):
                    errors.append(f"{metadata_path}: FigureSpec SHA 不一致")
            else:
                errors.append(f"{spec_path}: deterministic mode 必须发布 SVG")
        else:
            if metadata.get("schema") != "n-azure/image-generation@1":
                errors.append(f"{metadata_path}: schema 非法")
            if metadata.get("model") != "gpt-image-2":
                errors.append(f"{metadata_path}: model 必须是 gpt-image-2")
            if metadata.get("mode") != "edit":
                errors.append(f"{metadata_path}: 必须通过 image edit 读取原图")
            references = metadata.get("references")
            expected_source = figure.get("source", {}).get("png", {}).get("sha256")
            reference_shas = {
                item.get("sha256")
                for item in references
                if isinstance(item, dict)
            } if isinstance(references, list) else set()
            if not expected_source or expected_source not in reference_shas:
                errors.append(f"{metadata_path}: 未记录当前原图 PNG SHA")
            if metadata.get("output", {}).get("sha256") != sha256(path):
                errors.append(f"{metadata_path}: output SHA 与 PNG 不一致")
            if not isinstance(metadata.get("prompt"), str) or not metadata["prompt"].strip():
                errors.append(f"{metadata_path}: prompt 不能为空")
    return errors


def validate_source(book: Path, source: object, expected_path: Path, label: str) -> list[str]:
    if not isinstance(source, dict):
        return [f"{label}.source 必须是对象"]
    errors = []
    current = load(expected_path)
    if source.get("path") != expected_path.relative_to(book).as_posix():
        errors.append(f"{label}.source.path 不匹配")
    if source.get("sha256") != sha256(expected_path):
        errors.append(f"{label}.source 已过期")
    if source.get("data") != current:
        errors.append(f"{label}.source.data 不是当前原书 JSON 的完整快照")
    return errors


def validate_lesson(
    book: Path,
    edition: Path,
    lesson_id: str,
    profile: dict,
) -> tuple[dict, dict, dict, list[str]]:
    target = edition / "lessons" / lesson_id
    lesson_path = target / "lesson.json"
    exercises_path = target / "exercises.json"
    figures_path = target / "figures.json"
    lesson = load(lesson_path)
    exercises = load(exercises_path)
    normalize_exercise_layout(exercises)
    figures = load(figures_path)
    raw_lesson_path = book / "lessons" / lesson_id / "lesson.json"
    raw_exercises_path = book / "lessons" / lesson_id / "exercises.json"
    raw_lesson = load(raw_lesson_path)
    raw_exercises = load(raw_exercises_path)
    forbidden = [
        *profile.get("forbidden_terms", []),
        *profile.get("forbidden_person_names", []),
    ]
    errors = []

    if lesson.get("schema") != LESSON_SCHEMA:
        errors.append(f"lesson.schema 必须是 {LESSON_SCHEMA}")
    if exercises.get("schema") != EXERCISES_SCHEMA:
        errors.append(f"exercises.schema 必须是 {EXERCISES_SCHEMA}")
    if figures.get("schema") != FIGURES_SCHEMA:
        errors.append(f"figures.schema 必须是 {FIGURES_SCHEMA}")
    for name, document in (("lesson", lesson), ("exercises", exercises), ("figures", figures)):
        if document.get("edition") != edition.name:
            errors.append(f"{name}.edition 必须是 {edition.name}")
    errors += validate_source(book, lesson.get("source"), raw_lesson_path, "lesson")
    errors += validate_source(book, exercises.get("source"), raw_exercises_path, "exercises")

    for field in IDENTITY_FIELDS:
        if lesson.get(field) != raw_lesson.get(field):
            errors.append(f"lesson.{field} 不得改变")
    raw_prose = raw_lesson.get("prose", [])
    modern_prose_items = lesson.get("prose")
    if not isinstance(modern_prose_items, list) or len(modern_prose_items) != len(raw_prose):
        errors.append("lesson.prose 数量与原书不一致")
        modern_prose_items = []
    for index, (source_block, modern_block) in enumerate(zip(raw_prose, modern_prose_items)):
        label = f"lesson.prose[{index}]"
        if modern_block.get("source_text") != source_block.get("text", ""):
            errors.append(f"{label}.source_text 与原书不一致")
        for field in ("kind", "id", "label", "printed_page"):
            if modern_block.get(field) != source_block.get(field):
                errors.append(f"{label}.{field} 不得改变")
        errors += validate_text(
            source_block.get("text", ""),
            modern_block.get("text"),
            modern_block.get("changes"),
            modern_block.get("numeric_changes"),
            label,
            forbidden,
        )

    raw_items = raw_exercises.get("exercises", [])
    modern_items = exercises.get("exercises")
    if not isinstance(modern_items, list) or len(modern_items) != len(raw_items):
        errors.append("exercises.exercises 数量与原书不一致")
        modern_items = []
    for index, (source_item, modern_item) in enumerate(zip(raw_items, modern_items)):
        label = f"exercises[{index}]"
        if modern_item.get("source_text") != source_item.get("text", ""):
            errors.append(f"{label}.source_text 与原书不一致")
        for field in ("number", "group", "figure_refs", "figures"):
            if modern_item.get(field) != source_item.get(field):
                errors.append(f"{label}.{field} 不得改变")
        errors += validate_text(
            source_item.get("text", ""),
            modern_item.get("text"),
            modern_item.get("changes"),
            modern_item.get("numeric_changes"),
            label,
            forbidden,
        )
        errors += [
            f"{label}: {error}"
            for error in validate_numbered_subpart_layout(modern_item.get("text"))
        ]

    raw_figure_ids = [item["id"] for item in raw_lesson.get("figures", [])]
    figure_items = figures.get("figures")
    if not isinstance(figure_items, list):
        errors.append("figures.figures 必须是数组")
        figure_items = []
    if [item.get("id") for item in figure_items] != raw_figure_ids:
        errors.append("现代图 id 或顺序与原书不一致")
    for figure in figure_items:
        spec_path = edition / figure.get("spec", "")
        if figure.get("png"):
            generation = figure.get("generation")
            if not isinstance(generation, str) or not generation:
                errors.append(f"{figure.get('id')}: 缺 generation 元数据路径")
                generation = f"figures/{figure.get('id')}.png.json"
            errors += validate_png(
                edition / figure["png"],
                edition / generation,
                spec_path,
                figure,
            )
            raw_figure = book / "figures" / f"{figure.get('id')}.png"
            recorded = figure.get("source", {}).get("png", {}).get("sha256")
            if raw_figure.exists() and recorded != sha256(raw_figure):
                errors.append(f"{figure.get('id')}: 原书 PNG 来源已过期")
        else:
            # Transitional compatibility until legacy specs are migrated to
            # ld-s10y-image/figure-spec@1.
            svg_path = edition / figure.get("svg", "")
            render_path = edition / figure.get(
                "render",
                f"{figure.get('svg', '')}.json",
            )
            errors += validate_svg(
                svg_path,
                spec_path,
                figure,
                profile.get("figure_text_language"),
                render_path,
            )
            raw_figure = book / "figures" / f"{figure.get('id')}.svg"
            recorded = figure.get("source", {}).get("svg", {}).get("sha256")
            if raw_figure.exists() and recorded != sha256(raw_figure):
                errors.append(f"{figure.get('id')}: 原书 SVG 来源已过期")
    return lesson, exercises, figures, errors


def update_book_index(edition: Path, profile_path: Path, lesson_rows: list[dict]) -> None:
    path = edition / "book.json"
    existing = load(path) if path.exists() else {
        "schema": BOOK_SCHEMA,
        "edition": edition.name,
        "status": "ready",
        "profile": {
            "id": load(profile_path)["id"],
            "path": profile_path.as_posix(),
            "sha256": sha256(profile_path),
        },
        "lessons": [],
    }
    existing["profile"] = {
        "id": load(profile_path)["id"],
        "path": profile_path.as_posix(),
        "sha256": sha256(profile_path),
    }
    by_id = {item["id"]: item for item in existing.get("lessons", [])}
    for row in lesson_rows:
        by_id[row["id"]] = row
    existing["status"] = "ready"
    existing["lessons"] = sorted(by_id.values(), key=lambda item: int(item["number"]))
    dump(path, existing)


def cmd_finalize(args: argparse.Namespace) -> int:
    book = source_dir(args)
    edition = edition_dir(args)
    profile_path = Path(args.profile)
    profile = load(profile_path)
    failed = False
    index_rows = []
    for lesson_id in selected_lessons(args):
        lesson, exercises, figures, errors = validate_lesson(
            book, edition, lesson_id, profile,
        )
        target = edition / "lessons" / lesson_id
        if errors:
            failed = True
            dump(target / "adaptation.audit.json", {
                "schema": AUDIT_SCHEMA,
                "edition": args.edition,
                "lesson": lesson_id,
                "status": "fail",
                "errors": errors,
            })
            for error in errors:
                print(f"ERROR {lesson_id}: {error}")
            continue
        for document, path in (
            (lesson, target / "lesson.json"),
            (exercises, target / "exercises.json"),
            (figures, target / "figures.json"),
        ):
            document["status"] = "ready"
            dump(path, document)
        changed_prose = sum(item["text"] != item["source_text"] for item in lesson["prose"])
        changed_exercises = sum(
            item["text"] != item["source_text"] for item in exercises["exercises"]
        )
        audit = {
            "schema": AUDIT_SCHEMA,
            "edition": args.edition,
            "lesson": lesson_id,
            "status": "pass",
            "sourceLessonSha256": lesson["source"]["sha256"],
            "sourceExercisesSha256": exercises["source"]["sha256"],
            "proseBlocks": len(lesson["prose"]),
            "changedProseBlocks": changed_prose,
            "exercises": len(exercises["exercises"]),
            "changedExercises": changed_exercises,
            "figures": len(figures["figures"]),
            "errors": [],
        }
        dump(target / "adaptation.audit.json", audit)
        index_rows.append({
            "id": lesson_id,
            "number": lesson["number"],
            "title": lesson["title"],
            "prose_blocks": len(lesson["prose"]),
            "exercises": len(exercises["exercises"]),
            "figures": len(figures["figures"]),
            "source_lesson_sha256": lesson["source"]["sha256"],
            "source_exercises_sha256": exercises["source"]["sha256"],
        })
        print(
            f"[adapt-finalize] {lesson_id}: PASS "
            f"正文改写 {changed_prose}/{len(lesson['prose'])}, "
            f"题改写 {changed_exercises}/{len(exercises['exercises'])}, "
            f"新图 {len(figures['figures'])}"
        )
    if not failed:
        update_book_index(edition, profile_path, index_rows)
    return 2 if failed else 0


def common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--book", required=True)
    parser.add_argument("--edition", required=True)
    parser.add_argument("--lesson", action="append")
    parser.add_argument("--root", default="resources/s10y-lessons")
    parser.add_argument(
        "--profile",
        default=str(Path(__file__).resolve().parent.parent / "profiles" / "modern-us-neutral.json"),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="生成和验证现代主题 edition")
    subparsers = parser.add_subparsers(dest="command", required=True)
    prepare = subparsers.add_parser("prepare")
    common(prepare)
    prepare.add_argument("--force", action="store_true")
    prepare.set_defaults(handler=cmd_prepare)
    finalize = subparsers.add_parser("finalize")
    common(finalize)
    finalize.set_defaults(handler=cmd_finalize)
    args = parser.parse_args()
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
