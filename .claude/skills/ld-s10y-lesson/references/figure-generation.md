# Modern-edition figures

Modern figure generation is owned by the project skill:

```text
.agents/skills/ld-s10y-image/
```

Load `ld-s10y-image` and follow its cap1–cap4 workflow. This lesson skill only
provides edition text, original figure references, rendering, and publishing.

The compatibility command below delegates to the new skill:

```bash
python .claude/skills/ld-s10y-lesson/tools/figure_context.py \
  --book 5m --edition modern-us-neutral --figure fig-29 \
  --output .tmp/s10y-image/fig-29/context.json
```

Do not create new figure rules here. `ld-s10y-image/figure-spec@1` is the single
contract for deterministic, hybrid, and GPT Image output.
