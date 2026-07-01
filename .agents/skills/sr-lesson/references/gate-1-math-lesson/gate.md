# Gate 1 — Math lesson

Use this gate after `capability-1-math-lesson` produces a rendered lesson HTML, **before** running the saver. Prefer an independent subagent so the producing agent does not defend its own work. Give the reviewer: the target outline section (stage/order/title/concept), `references/common/lesson-contract.md`, and the rendered `public/lessons/<id>.html`.

## Purpose Check (ask first)

> This lesson was created to make one math concept genuinely understood — its definition, the abstract structure under it, and its connections — at a low entry but full rigor. Can a capable young learner read it and still **miss the concept**, because it is vague, mathematically wrong, dumbed-down (concept deleted), padded with story/encouragement, or missing the structure?

If yes, the gate fails — regardless of how polished the HTML looks.

## Pass Conditions

- **Motivation (section 1)**: opens with a genuine motivating question that makes today's topic feel necessary — says why we study it / what it solves / what we can't yet do without it — posed inside the surrounding math system (ties to a limit or tension in prior lessons). It hands the learner one driving question to carry forward. It is NOT a dry objectives list ("学完你能…"), and it does NOT just duplicate the connections section's structural map.
- **Fitness**: the 讲解 actually builds the concept and names its abstract structure (the invariant/relationship), not just a procedure. Formal terms are introduced, not avoided.
- **深入浅出, not dumbed-down**: intuitive entry is present AND it lands on the standard definition/term. No standard concept was deleted to make it "easier".
- **Correctness**: every formula and every worked step is mathematically correct; every SVG figure is geometrically/numerically correct and labeled.
- **One concept**: no smuggling of multiple new concepts or later-lesson terms.
- **Examples**: 3–5, worked step-by-step; last one requires explaining a reason.
- **Practice**: 8–15 items spanning 辨认 / 表示 / 操作 / 反推 / 辨错; answers present; no word problems.
- **Connections**: substantive prerequisite→next through-line, not bare titles.
- **Tone**: no science-story fluff, no encouragement filler (docs 禁止事项).
- **Grounding**: matches the concept and altitude of this section in `docs/course-gen-guide-math.md`.

## Hard Checks (mechanical — the saver enforces these too)

- All five `data-sr-section` anchors present, in order: motivation, explain, examples, connections, practice (练习 last).
- No leftover `{{...}}` placeholder.
- KaTeX is wired (the template `<script>` for auto-render is intact) and math uses `$`/`$$` delimiters.
- At least one `<figure class="sr-fig"><svg ...>` when the concept is spatial/graphical (number line, coordinate, geometry, function) — and each figure has `<text>` labels.
- DESIGN tokens intact (`--sr-` present); section shells unmodified.

## Failure Handling

- Rerun `cap-1` (steps 3–4) with the findings as constraints when the issue is repairable without user input.
- Return to grounding (step 2) when the lesson drifted from the outline's concept/altitude.
- Ask the user when a real curriculum decision is unresolved.
- Stop and report when the same semantic blocker survives repeated rework — do not weaken this gate to force a pass.
