#!/usr/bin/env python3
"""Convert a legacy modern-edition SVG into a draft deterministic FigureSpec."""

from __future__ import annotations

import argparse
import json
import math
import re
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path


NS = "{http://www.w3.org/2000/svg}"
NUMBER = re.compile(r"-?(?:\d+(?:\.\d*)?|\.\d+)")


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def number(value: str | None, default: float = 0) -> float:
    if value is None:
        return default
    match = NUMBER.search(value)
    return float(match.group()) if match else default


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_style(value: str | None) -> dict[str, str]:
    result = {}
    for item in (value or "").split(";"):
        if ":" in item:
            key, content = item.split(":", 1)
            result[key.strip()] = content.strip()
    return result


def merged_style(parent: dict[str, str], node: ET.Element) -> dict[str, str]:
    result = dict(parent)
    result.update(parse_style(node.get("style")))
    for key in (
        "fill", "fill-opacity", "stroke", "stroke-opacity", "stroke-width",
        "stroke-dasharray", "font-size", "font-weight", "text-anchor",
    ):
        if node.get(key) is not None:
            result[key] = node.get(key)
    return result


def color(value: str | None, *, text: bool = False) -> str:
    if not value or value == "currentColor":
        return "ink" if text else "primary"
    if value in {"#0f766e", "#0f8b8d"}:
        return "primary"
    if value in {"#16a34a", "#58a942", "#166534"}:
        return "secondary"
    if value.startswith("url("):
        return "#e8efed"
    return value


def points(value: str, height: float) -> list[list[float]]:
    values = [float(item) for item in NUMBER.findall(value)]
    return [
        [values[index], height - values[index + 1]]
        for index in range(0, len(values) - 1, 2)
    ]


def context_text(context: dict) -> list[dict]:
    result = []
    seen = set()
    for lesson in context.get("lessons", []):
        for prose in lesson.get("prose", []):
            for text in prose.get("nearbyText", []):
                key = (lesson["lesson"], "", text)
                if key not in seen:
                    seen.add(key)
                    result.append({"lesson": lesson["lesson"], "text": text})
        for exercise in lesson.get("exercises", []):
            text = exercise.get("text", "")
            key = (lesson["lesson"], exercise.get("exercise", ""), text)
            if text and key not in seen:
                seen.add(key)
                result.append({
                    "lesson": lesson["lesson"],
                    "exercise": exercise.get("exercise", ""),
                    "text": text,
                })
    return result


def output_size(width: float, height: float) -> tuple[int, int, float]:
    scale = max(1.0, 1024 / width, 320 / height)
    return round(width * scale), round(height * scale), scale


def point_in_polygon(point: list[float], polygon: list[list[float]]) -> bool:
    x, y = point
    inside = False
    previous = polygon[-1]
    for current in polygon:
        x1, y1 = previous
        x2, y2 = current
        if (y1 > y) != (y2 > y):
            crossing = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < crossing:
                inside = not inside
        previous = current
    return inside


def project_to_segment(
    point: list[float],
    start: list[float],
    end: list[float],
) -> tuple[list[float], float]:
    dx, dy = end[0] - start[0], end[1] - start[1]
    length_squared = dx * dx + dy * dy
    if length_squared == 0:
        projected = start
    else:
        t = max(
            0,
            min(
                1,
                ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy)
                / length_squared,
            ),
        )
        projected = [start[0] + t * dx, start[1] + t * dy]
    return projected, math.dist(point, projected)


def add_declared_points(
    objects: list[dict],
    description: str,
    width: float,
    height: float,
    scale: float,
) -> None:
    if "point" not in description.lower():
        return
    texts = [
        item
        for item in objects
        if item["type"] == "text"
        and re.fullmatch(r"[A-Z]", item.get("text", ""))
    ]
    if not texts:
        return
    polygons = [
        item["points"]
        for item in objects
        if item["type"] == "polygon"
    ]
    segments = [
        (item["from"], item["to"])
        for item in objects
        if item["type"] == "segment"
    ]
    existing_points = [
        item
        for item in objects
        if item["type"] == "point"
    ]
    threshold = max(width, height) * 0.16
    inserted = []
    used_point_ids = set()
    for text in texts:
        anchor = text["at"]
        target = None
        nearest_point = min(
            (
                (math.dist(anchor, item["at"]), item)
                for item in existing_points
                if item["id"] not in used_point_ids
            ),
            default=None,
        )
        if nearest_point and nearest_point[0] <= threshold:
            target = nearest_point[1]["at"]
            used_point_ids.add(nearest_point[1]["id"])

        short_marker = min(
            (
                project_to_segment(anchor, start, end)[1]
                for start, end in segments
                if math.dist(start, end) <= max(width, height) * 0.12
            ),
            default=float("inf"),
        )
        if target is None and short_marker <= threshold:
            continue
        if target is None and len(segments) >= 6:
            continue

        inside_closed_shape = target is None and any(
            point_in_polygon(anchor, polygon)
            for polygon in polygons
        )
        if inside_closed_shape:
            target = anchor
        best_distance = float("inf")
        if target is None:
            for start, end in segments:
                candidate, candidate_distance = project_to_segment(
                    anchor, start, end
                )
                if candidate_distance < best_distance:
                    target = candidate
                    best_distance = candidate_distance
            if best_distance > threshold:
                target = None
        if target is None:
            continue
        if nearest_point is None or target is not nearest_point[1]["at"]:
            inserted.append({
                "id": f"point-declared-{len(inserted) + 1}",
                "type": "point",
                "at": target,
                "size": max(3, 2.2 * scale),
                "fill": "primary",
                "stroke": "primary",
            })
        text["at"] = target
        text["textAnchor"] = "middle"
        text["dominantBaseline"] = "middle"
        text["labelPlacement"] = {
            "fallback": True,
            "gap": text["fontSize"],
        }
    if inserted:
        first_text = next(
            index
            for index, item in enumerate(objects)
            if item["type"] == "text"
        )
        objects[first_text:first_text] = inserted


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--context", type=Path, required=True)
    parser.add_argument("--legacy-svg", type=Path, required=True)
    parser.add_argument("--legacy-spec", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    context = load(args.context)
    legacy_spec = load(args.legacy_spec)
    root = ET.parse(args.legacy_svg).getroot()
    view_box = [float(item) for item in root.get("viewBox", "").split()]
    if len(view_box) != 4 or view_box[0] != 0 or view_box[1] != 0:
        raise SystemExit("ERROR: legacy SVG requires viewBox='0 0 width height'")
    width, height = view_box[2], view_box[3]
    canvas_width, canvas_height, scale = output_size(width, height)
    objects: list[dict] = []
    counts = Counter()

    def object_id(kind: str) -> str:
        counts[kind] += 1
        return f"{kind}-{counts[kind]}"

    def line_style(style: dict[str, str]) -> dict:
        return {
            "stroke": color(style.get("stroke")),
            "strokeWidth": max(1, number(style.get("stroke-width"), 1) * scale),
            "opacity": number(style.get("stroke-opacity"), 1),
        }

    def shape_style(style: dict[str, str]) -> dict:
        fill = style.get("fill", "none")
        return {
            **line_style(style),
            "fill": color(fill),
            "fillOpacity": 0 if fill == "none" else number(
                style.get("fill-opacity"), 1
            ),
        }

    def walk(node: ET.Element, inherited: dict[str, str], in_defs: bool = False) -> None:
        tag = local_name(node.tag)
        style = merged_style(inherited, node)
        in_defs = in_defs or tag in {"defs", "marker", "pattern", "symbol"}
        if not in_defs and tag == "line":
            objects.append({
                "id": object_id("segment"),
                "type": "segment",
                "from": [number(node.get("x1")), height - number(node.get("y1"))],
                "to": [number(node.get("x2")), height - number(node.get("y2"))],
                **line_style(style),
            })
        elif not in_defs and tag == "circle":
            radius = number(node.get("r"))
            center = [number(node.get("cx")), height - number(node.get("cy"))]
            if radius <= 9 and style.get("fill", "none") != "none":
                objects.append({
                    "id": object_id("point"),
                    "type": "point",
                    "at": center,
                    "size": max(3, radius * scale * 0.45),
                    "fill": color(style.get("fill")),
                    "stroke": color(style.get("stroke")),
                })
            else:
                objects.append({
                    "id": object_id("circle"),
                    "type": "circle",
                    "center": center,
                    "radius": radius,
                    **shape_style(style),
                })
        elif not in_defs and tag == "ellipse":
            cx, cy = number(node.get("cx")), number(node.get("cy"))
            rx, ry = number(node.get("rx")), number(node.get("ry"))
            values = [
                [
                    cx + rx * math.cos(index * math.tau / 48),
                    height - (cy + ry * math.sin(index * math.tau / 48)),
                ]
                for index in range(48)
            ]
            objects.append({
                "id": object_id("polygon"),
                "type": "polygon",
                "points": values,
                **shape_style(style),
            })
        elif not in_defs and tag == "rect":
            x, y = number(node.get("x")), number(node.get("y"))
            w, h = number(node.get("width")), number(node.get("height"))
            objects.append({
                "id": object_id("polygon"),
                "type": "polygon",
                "points": [
                    [x, height - y],
                    [x + w, height - y],
                    [x + w, height - y - h],
                    [x, height - y - h],
                ],
                **shape_style(style),
            })
        elif not in_defs and tag == "polygon":
            objects.append({
                "id": object_id("polygon"),
                "type": "polygon",
                "points": points(node.get("points", ""), height),
                **shape_style(style),
            })
        elif not in_defs and tag == "polyline":
            values = points(node.get("points", ""), height)
            for start, end in zip(values, values[1:]):
                objects.append({
                    "id": object_id("segment"),
                    "type": "segment",
                    "from": start,
                    "to": end,
                    **line_style(style),
                })
        elif not in_defs and tag == "path":
            objects.append({
                "id": object_id("svgPath"),
                "type": "svgPath",
                "d": node.get("d", ""),
                "stroke": color(style.get("stroke", "none")),
                "fill": color(style.get("fill", "none")),
                "strokeWidth": max(1, number(style.get("stroke-width"), 1) * scale),
                "strokeOpacity": number(style.get("stroke-opacity"), 1),
                "fillOpacity": number(style.get("fill-opacity"), 1),
            })
        elif not in_defs and tag == "text":
            text = "".join(node.itertext()).strip()
            if text:
                objects.append({
                    "id": object_id("text"),
                    "type": "text",
                    "at": [number(node.get("x")), height - number(node.get("y"))],
                    "text": text,
                    "fontSize": max(
                        10,
                        number(style.get("font-size"), 14) * scale,
                    ),
                    "fontWeight": int(number(style.get("font-weight"), 600)),
                    "labelColor": color(style.get("fill"), text=True),
                    "textAnchor": style.get("text-anchor", "start"),
                    "dominantBaseline": "alphabetic",
                    "labelPlacement": {
                        "position": "CENTER",
                        "fallback": True,
                    },
                })
        for child in node:
            walk(child, style, in_defs)

    walk(root, {})
    add_declared_points(
        objects,
        legacy_spec.get("description", ""),
        width,
        height,
        scale,
    )
    assertions = [
        {
            "type": "objectCount",
            "objectType": kind,
            "count": count,
        }
        for kind, count in sorted(
            Counter(item["type"] for item in objects).items()
        )
    ]
    payload = {
        "schema": "ld-s10y-image/figure-spec@1",
        "id": context["figure"],
        "mode": "deterministic",
        "description": legacy_spec.get("description", context["figure"]),
        "source": {
            "image": {
                "path": context["sourceImage"]["path"],
                "sha256": context["sourceImage"]["sha256"],
            },
            "authoritativeText": context_text(context),
        },
        "canvas": {
            "width": canvas_width,
            "height": canvas_height,
            "boundingBox": [0, height, width, 0],
            "background": "#ffffff",
            "keepAspectRatio": True,
        },
        "palette": {
            "primary": "#0f8b8d",
            "secondary": "#58a942",
            "ink": "#172526",
            "grid": "#9acfd0",
        },
        "objects": objects,
        "assertions": assertions,
        "layout": {
            "minLabelGap": 2,
            "avoidRegions": [],
        },
        "review": {
            "status": "draft",
            "notes": "Draft migrated from legacy edition SVG; requires visual review.",
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"{context['figure']}: {len(objects)} objects "
        f"({dict(Counter(item['type'] for item in objects))})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
