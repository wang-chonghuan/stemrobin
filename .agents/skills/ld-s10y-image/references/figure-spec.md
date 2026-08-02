# FigureSpec contract

The canonical schema is
`assets/figure-spec.schema.json`; the semantic validator is
`scripts/validate_spec.py`.

## Required top-level fields

- `schema`: `ld-s10y-image/figure-spec@1`
- `id`: original figure id
- `mode`: `deterministic`, `hybrid`, or `generated`
- `description`: instructional purpose, not merely appearance
- `source.image`: original PNG path and SHA-256
- `source.authoritativeText`: complete relevant edition text
- `canvas`: pixel size and mathematical bounding box
- `objects`: ordered render objects
- `assertions`: machine-checkable mathematical facts
- `review`: draft/pass/fail human visual review

Coordinates use JSXGraph user space. `canvas.boundingBox` is
`[xMin, yMax, xMax, yMin]`.

## Supported objects

- `point`: `at`, optional `label`, `visible`, style
- `segment`, `line`, `arrow`: `from`, `to`
- `circle`: `center`, `radius`
- `polygon`: `points`
- `arc`: `center`, `start`, `end`
- `grid`: `xStep`, `yStep`
- `axis`: `from`, `to`, optional ticks
- `measure`: `from`, `to`, `label`
- `text`: `at`, `text`
- `image`: `asset`, `at`, `size`; hybrid artwork only. `size` is a fit box:
  the renderer always preserves the source artwork's intrinsic aspect ratio
  with centered `contain` behavior and must never stretch it to fill the box.
  Put image objects before geometry objects so the exact overlay is always on top. Set
  `avoidLabels: true` only when its tight image rectangle must exclude labels;
  otherwise use `layout.avoidRegions` for occupied artwork areas. Optional
  `rotation` contains `angleDegrees` and `center`; the renderer applies an
  exact JSXGraph rotation around that user-coordinate center.
- `svgPath`: deterministic fallback for a curve or filled region JSXGraph
  cannot express directly. It uses source-screen path coordinates and must not
  contain labels, ticks, points, or measurements.

Point references may be object ids. Coordinate literals are `[x, y]`.

## Labels

Labels are an overlay owned by the renderer, not freehand SVG text. Default
placement tests eight candidates around the anchor and scores collisions
against earlier labels, visible points, declared image regions, and
`layout.avoidRegions`.

Use `labelPlacement` only when the semantic layout requires a fixed side:

```json
{
  "position": "NE",
  "offset": [8, -8]
}
```

Never compensate for a wrong coordinate by moving a label.

## Assertions

Use assertions for every relationship required by the exercise:

- `distance`
- `equalDistance`
- `collinear`
- `parallel`
- `perpendicular`
- `pointOnLine`
- `centralSymmetry`: `center` plus every defining opposite point pair in
  `pairs`; each pair's midpoint must equal the declared center
- `objectCount`

Assertions validate source-space mathematics before rendering. The render
report separately validates label overlap and clipping.

When the description or authoritative text says a figure is centrally
symmetric or invariant under a half-turn, `centralSymmetry` is mandatory.
Do not use an opaque `svgPath` for the claimed symmetric object: construct its
defining vertices deterministically and include all opposite pairs.
