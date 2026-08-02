# GPT Image artwork

Use `n-azure` cap4. Supply:

1. complete relevant modern-edition text
2. the original extracted PNG as a reference image
3. an explicit statement that text overrides source pixels
4. the selected rendering mode

For `generated`, request the complete semantic illustration.

For `hybrid`, request artwork only:

- no numbers, letters, labels, axes, grid, scale, dimension lines, arrows, or
  answer annotations
- clean white or transparent background
- objects separated enough for deterministic overlay
- natural colors with teal/green accents

Azure `gpt-image-2` may reject `background=transparent` or paint a checkerboard
instead of returning alpha. Generate on a light neutral background, then remove
only the background region connected to the canvas border:

```bash
.claude/skills/ld-s10y-lesson/.venv/bin/python \
  .agents/skills/ld-s10y-image/scripts/remove_background.py \
  artwork-opaque.png artwork.png
```

Keep the original `n-azure/image-generation@1` metadata beside the derived
transparent asset. Reject the result if background removal erases any part of
the semantic object or leaves a visible checkerboard halo.

Example:

```bash
python <n-azure-skill>/scripts/generate_image.py \
  --prompt-file .tmp/s10y-image/fig-29/artwork-prompt.txt \
  --reference-image resources/s10y-lessons/5m/figures/fig-29.png \
  --output .tmp/s10y-image/fig-29/artwork.png \
  --background transparent --quality high --size 1024x1536
```

Keep the `n-azure/image-generation@1` metadata beside the asset. FigureSpec
must reference both files.
