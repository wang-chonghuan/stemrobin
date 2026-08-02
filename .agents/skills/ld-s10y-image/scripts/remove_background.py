#!/usr/bin/env python3
"""Remove a light neutral background connected to the image border."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


def is_background(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return (
        alpha > 0
        and min(red, green, blue) >= 185
        and max(red, green, blue) - min(red, green, blue) <= 32
    )


def remove_background(source: Path, output: Path) -> int:
    image = Image.open(source).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    queue: deque[tuple[int, int]] = deque()
    visited = bytearray(width * height)

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if visited[index] or not is_background(pixels[x, y]):
            return
        visited[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    removed = 0
    while queue:
        x, y = queue.popleft()
        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        removed += 1
        if x:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    if removed < width * height * 0.05:
        raise SystemExit(
            f"ERROR: removed only {removed} pixels; background was not detected"
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)
    return removed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f"ERROR: missing source image: {args.source}")
    removed = remove_background(args.source, args.output)
    print(f"Removed {removed} background pixels: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
