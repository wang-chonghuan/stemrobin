# Rendering mode routing

Choose the least generative mode that can express the figure.

| Mode | Use when | Final construction |
|---|---|---|
| `deterministic` | Geometry, sets, number lines, coordinates, tables, charts, transformations, measured diagrams | JSXGraph-generated SVG; optional PNG snapshot |
| `hybrid` | Natural objects must sit at mathematically exact positions | GPT Image artwork below a JSXGraph overlay |
| `generated` | Object identity, count, or scene matters, but exact coordinates do not | GPT Image 2 PNG |

## Hard routing rules

- Any exact point, tick, number, distance, angle, grid intersection, alignment,
  parallelism, perpendicularity, symmetry, or transformation makes the
  mathematical layer deterministic.
- A decorative illustration does not justify making the mathematical layer
  generative.
- Do not ask GPT Image to draw readable scales, coordinate axes, tables, or
  multi-label geometry.
- Do not use a generated PNG as the sole output when the exercise depends on
  measuring or counting equal intervals.

## Examples

- Animal/plant classification collection: `generated`.
- Squirrels at measured heights on a tree: `hybrid`; tree and squirrels are
  artwork, height guides and labels are deterministic.
- Birds on a rope at signed offsets: `hybrid`; birds and rope may be artwork,
  knot, grid, scale, and placements are deterministic.
- Half-turn around point O: `deterministic`; optional child artwork may be
  transformed as a paired image asset, but the transform is computed.
- Venn diagrams, polygons, angle diagrams, number lines: `deterministic`.
