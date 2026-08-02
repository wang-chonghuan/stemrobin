#!/usr/bin/env python3
"""Validate an ld-s10y-image FigureSpec and its mathematical assertions."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any


SCHEMA = "ld-s10y-image/figure-spec@1"
NON_ENGLISH = re.compile(
    r"[\u0400-\u04ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]"
)
CENTRAL_SYMMETRY = re.compile(
    r"中心对称|对称中心|central symmetry|centrally symmetric|half-turn|"
    r"180(?:°| degrees?)",
    re.IGNORECASE,
)
GEOMETRY_TYPES = {
    "point", "segment", "line", "arrow", "circle", "polygon", "arc",
    "grid", "axis", "measure", "svgPath",
}
SUPPORTED_TYPES = GEOMETRY_TYPES | {"text", "image"}


def load(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"ERROR: missing spec: {path}")
    except json.JSONDecodeError as error:
        raise SystemExit(f"ERROR: invalid JSON {path}: {error}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def finite_number(value: Any) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def coordinate(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 2
        and all(finite_number(item) for item in value)
    )


def point_map(objects: list[dict]) -> dict[str, tuple[float, float]]:
    points = {}
    for item in objects:
        if item.get("type") == "point" and coordinate(item.get("at")):
            points[item["id"]] = tuple(item["at"])
    return points


def resolve_point(
    value: Any,
    points: dict[str, tuple[float, float]],
    label: str,
    errors: list[str],
) -> tuple[float, float] | None:
    if coordinate(value):
        return float(value[0]), float(value[1])
    if isinstance(value, str) and value in points:
        return points[value]
    errors.append(f"{label}: expected coordinate or point id")
    return None


def distance(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def vector(a: tuple[float, float], b: tuple[float, float]) -> tuple[float, float]:
    return b[0] - a[0], b[1] - a[1]


def cross(a: tuple[float, float], b: tuple[float, float]) -> float:
    return a[0] * b[1] - a[1] * b[0]


def dot(a: tuple[float, float], b: tuple[float, float]) -> float:
    return a[0] * b[0] + a[1] * b[1]


def assertion_errors(
    assertions: list[dict],
    objects: list[dict],
    points: dict[str, tuple[float, float]],
) -> list[str]:
    errors = []
    for index, item in enumerate(assertions):
        label = f"assertions[{index}]"
        kind = item.get("type")
        tolerance = item.get("tolerance", 1e-6)
        if not finite_number(tolerance) or tolerance < 0:
            errors.append(f"{label}.tolerance must be a nonnegative number")
            continue
        if kind == "objectCount":
            object_type = item.get("objectType")
            expected = item.get("count")
            actual = sum(obj.get("type") == object_type for obj in objects)
            if not isinstance(expected, int) or actual != expected:
                errors.append(
                    f"{label}: expected {expected} {object_type}, found {actual}"
                )
            continue
        if kind == "centralSymmetry":
            center = resolve_point(
                item.get("center"), points, f"{label}.center", errors
            )
            pairs = item.get("pairs")
            if not isinstance(pairs, list) or not pairs:
                errors.append(f"{label}.pairs must be a nonempty array")
                continue
            if center is None:
                continue
            for pair_index, pair in enumerate(pairs):
                pair_label = f"{label}.pairs[{pair_index}]"
                if not isinstance(pair, dict):
                    errors.append(f"{pair_label} must be an object")
                    continue
                first = resolve_point(
                    pair.get("a"), points, f"{pair_label}.a", errors
                )
                second = resolve_point(
                    pair.get("b"), points, f"{pair_label}.b", errors
                )
                if first is None or second is None:
                    continue
                midpoint = (
                    (first[0] + second[0]) / 2,
                    (first[1] + second[1]) / 2,
                )
                if distance(midpoint, center) > tolerance:
                    errors.append(
                        f"{pair_label}: midpoint {midpoint} != center {center}"
                    )
            continue

        names = {
            "distance": ("a", "b"),
            "equalDistance": ("a", "b", "c", "d"),
            "collinear": ("a", "b", "c"),
            "parallel": ("a", "b", "c", "d"),
            "perpendicular": ("a", "b", "c", "d"),
            "pointOnLine": ("point", "a", "b"),
        }.get(kind)
        if not names:
            errors.append(f"{label}: unsupported assertion type {kind!r}")
            continue
        resolved = {
            name: resolve_point(item.get(name), points, f"{label}.{name}", errors)
            for name in names
        }
        if any(value is None for value in resolved.values()):
            continue

        if kind == "distance":
            actual = distance(resolved["a"], resolved["b"])
            expected = item.get("value")
            if not finite_number(expected) or abs(actual - expected) > tolerance:
                errors.append(
                    f"{label}: distance {actual:.8g} != {expected!r}"
                )
        elif kind == "equalDistance":
            first = distance(resolved["a"], resolved["b"])
            second = distance(resolved["c"], resolved["d"])
            if abs(first - second) > tolerance:
                errors.append(
                    f"{label}: distances {first:.8g} and {second:.8g} differ"
                )
        elif kind == "collinear":
            value = abs(cross(
                vector(resolved["a"], resolved["b"]),
                vector(resolved["a"], resolved["c"]),
            ))
            if value > tolerance:
                errors.append(f"{label}: points are not collinear")
        elif kind in {"parallel", "perpendicular"}:
            first = vector(resolved["a"], resolved["b"])
            second = vector(resolved["c"], resolved["d"])
            scale = max(math.hypot(*first) * math.hypot(*second), 1.0)
            value = (
                abs(cross(first, second))
                if kind == "parallel"
                else abs(dot(first, second))
            )
            if value > tolerance * scale:
                errors.append(f"{label}: lines are not {kind}")
        elif kind == "pointOnLine":
            value = abs(cross(
                vector(resolved["a"], resolved["b"]),
                vector(resolved["a"], resolved["point"]),
            ))
            if value > tolerance:
                errors.append(f"{label}: point is not on line")
    return errors


def validate(spec_path: Path, stage: str) -> list[str]:
    spec = load(spec_path)
    errors: list[str] = []
    if spec.get("schema") != SCHEMA:
        errors.append(f"schema must be {SCHEMA}")
    if (
        not isinstance(spec.get("id"), str)
        or not re.fullmatch(r"(fig|tbl)-[A-Za-z0-9-]+", spec["id"])
    ):
        errors.append("id must start with fig- or tbl-")
    mode = spec.get("mode")
    if mode not in {"deterministic", "hybrid", "generated"}:
        errors.append("mode must be deterministic, hybrid, or generated")
    if not isinstance(spec.get("description"), str) or not spec["description"].strip():
        errors.append("description must be nonempty")

    source = spec.get("source")
    if not isinstance(source, dict):
        errors.append("source must be an object")
        source = {}
    source_image = source.get("image")
    if not isinstance(source_image, dict):
        errors.append("source.image must be an object")
        source_image = {}
    image_path = source_image.get("path")
    image_sha = source_image.get("sha256")
    if not isinstance(image_path, str) or not image_path:
        errors.append("source.image.path must be nonempty")
    elif stage in {"rendered", "approved"}:
        path = Path(image_path)
        if not path.is_file():
            errors.append(f"missing source image: {path}")
        elif image_sha != sha256(path):
            errors.append("source.image.sha256 is stale")
    if not isinstance(image_sha, str) or not re.fullmatch(r"[a-f0-9]{64}", image_sha):
        errors.append("source.image.sha256 must be lowercase SHA-256")
    authoritative = source.get("authoritativeText")
    if not isinstance(authoritative, list) or not authoritative:
        errors.append("source.authoritativeText must be nonempty")
        authoritative = []
    elif any(
        not isinstance(item, dict)
        or not isinstance(item.get("text"), str)
        or not item["text"].strip()
        for item in authoritative
    ):
        errors.append("every authoritativeText item needs nonempty text")

    canvas = spec.get("canvas")
    if not isinstance(canvas, dict):
        errors.append("canvas must be an object")
        canvas = {}
    for key in ("width", "height"):
        value = canvas.get(key)
        if not isinstance(value, int) or not 320 <= value <= 4096:
            errors.append(f"canvas.{key} must be an integer from 320 to 4096")
    bounding_box = canvas.get("boundingBox")
    if (
        not isinstance(bounding_box, list)
        or len(bounding_box) != 4
        or not all(finite_number(item) for item in bounding_box)
    ):
        errors.append("canvas.boundingBox must contain four finite numbers")
    elif not (
        bounding_box[0] < bounding_box[2]
        and bounding_box[3] < bounding_box[1]
    ):
        errors.append("canvas.boundingBox must be [xMin, yMax, xMax, yMin]")

    objects = spec.get("objects")
    if not isinstance(objects, list):
        errors.append("objects must be an array")
        objects = []
    ids = [item.get("id") for item in objects if isinstance(item, dict)]
    if any(not isinstance(value, str) or not value for value in ids):
        errors.append("every object needs a nonempty id")
    if len(ids) != len(set(ids)):
        errors.append("object ids must be unique")
    assets = spec.get("assets", [])
    if not isinstance(assets, list):
        errors.append("assets must be an array")
        assets = []
    asset_ids = {
        item.get("id")
        for item in assets
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    if len(asset_ids) != len(assets):
        errors.append("asset ids must be present and unique")

    points = point_map(objects)
    labels = []
    image_count = 0
    for index, item in enumerate(objects):
        label = f"objects[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{label} must be an object")
            continue
        kind = item.get("type")
        if kind not in SUPPORTED_TYPES:
            errors.append(f"{label}: unsupported type {kind!r}")
            continue
        for field in ("label", "text"):
            text = item.get(field)
            if isinstance(text, str) and text:
                labels.append((label, text))
        if kind == "point" and not coordinate(item.get("at")):
            errors.append(f"{label}.at must be [x, y]")
        elif kind in {"segment", "line", "arrow", "axis", "measure"}:
            resolve_point(item.get("from"), points, f"{label}.from", errors)
            resolve_point(item.get("to"), points, f"{label}.to", errors)
        elif kind == "circle":
            resolve_point(item.get("center"), points, f"{label}.center", errors)
            if not finite_number(item.get("radius")) or item["radius"] <= 0:
                errors.append(f"{label}.radius must be positive")
        elif kind == "polygon":
            values = item.get("points")
            if not isinstance(values, list) or len(values) < 3:
                errors.append(f"{label}.points needs at least three points")
            else:
                for point_index, value in enumerate(values):
                    resolve_point(
                        value, points, f"{label}.points[{point_index}]", errors
                    )
        elif kind == "arc":
            for field in ("center", "start", "end"):
                resolve_point(item.get(field), points, f"{label}.{field}", errors)
        elif kind == "grid":
            for field in ("xStep", "yStep"):
                if not finite_number(item.get(field)) or item[field] <= 0:
                    errors.append(f"{label}.{field} must be positive")
        elif kind == "text":
            resolve_point(item.get("at"), points, f"{label}.at", errors)
            if not isinstance(item.get("text"), str) or not item["text"].strip():
                errors.append(f"{label}.text must be nonempty")
        elif kind == "image":
            image_count += 1
            if item.get("asset") not in asset_ids:
                errors.append(f"{label}.asset does not resolve")
            if not coordinate(item.get("at")) or not coordinate(item.get("size")):
                errors.append(f"{label}.at and size must be [x, y]")
            elif item["size"][0] <= 0 or item["size"][1] <= 0:
                errors.append(f"{label}.size values must be positive")
            rotation = item.get("rotation")
            if rotation is not None:
                if not isinstance(rotation, dict):
                    errors.append(f"{label}.rotation must be an object")
                else:
                    if not finite_number(rotation.get("angleDegrees")):
                        errors.append(
                            f"{label}.rotation.angleDegrees must be finite"
                        )
                    if not coordinate(rotation.get("center")):
                        errors.append(
                            f"{label}.rotation.center must be [x, y]"
                        )
        elif kind == "svgPath":
            if not isinstance(item.get("d"), str) or not item["d"].strip():
                errors.append(f"{label}.d must be nonempty")
    for label, text in labels:
        if NON_ENGLISH.search(text):
            errors.append(f"{label}: visible text must be English: {text!r}")

    if mode == "generated" and objects:
        errors.append("generated mode must not contain deterministic objects")
    if mode == "hybrid" and image_count == 0:
        errors.append("hybrid mode requires an image object")
    if mode == "hybrid":
        first_geometry = next(
            (
                index
                for index, item in enumerate(objects)
                if isinstance(item, dict) and item.get("type") != "image"
            ),
            len(objects),
        )
        if any(
            isinstance(item, dict) and item.get("type") == "image"
            for item in objects[first_geometry:]
        ):
            errors.append("hybrid image objects must precede overlay objects")
    if mode == "deterministic" and image_count:
        errors.append("deterministic mode cannot contain image objects")

    if stage in {"rendered", "approved"}:
        for index, asset in enumerate(assets):
            path = Path(asset.get("path", ""))
            if not path.is_file():
                errors.append(f"assets[{index}]: missing file {path}")
            metadata = asset.get("metadata")
            if metadata and not Path(metadata).is_file():
                errors.append(f"assets[{index}]: missing metadata {metadata}")

    assertions = spec.get("assertions")
    if not isinstance(assertions, list):
        errors.append("assertions must be an array")
        assertions = []
    if mode in {"deterministic", "hybrid"} and any(
        item.get("type") in GEOMETRY_TYPES
        for item in objects
        if isinstance(item, dict)
    ) and not assertions:
        errors.append("mathematical objects require assertions")
    errors += assertion_errors(assertions, objects, points)
    symmetry_text = " ".join([
        spec.get("description", ""),
        *[
            item.get("text", "")
            for item in authoritative
            if isinstance(item, dict)
        ],
    ])
    if (
        mode in {"deterministic", "hybrid"}
        and CENTRAL_SYMMETRY.search(symmetry_text)
        and not any(
            isinstance(item, dict) and item.get("type") == "centralSymmetry"
            for item in assertions
        )
    ):
        errors.append(
            "central-symmetry content requires a centralSymmetry assertion"
        )

    review = spec.get("review")
    if not isinstance(review, dict) or review.get("status") not in {
        "draft", "pass", "fail"
    }:
        errors.append("review.status must be draft, pass, or fail")
    elif stage == "approved" and review.get("status") != "pass":
        errors.append("approved stage requires review.status pass")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", type=Path)
    parser.add_argument(
        "--stage",
        choices=("draft", "rendered", "approved"),
        default="draft",
    )
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    errors = validate(args.spec, args.stage)
    payload = {
        "schema": "ld-s10y-image/spec-validation@1",
        "spec": args.spec.as_posix(),
        "stage": args.stage,
        "status": "fail" if errors else "pass",
        "errors": errors,
    }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    elif errors:
        for error in errors:
            print(f"ERROR: {error}")
    else:
        print(f"PASS: {args.spec}")
    return 2 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
