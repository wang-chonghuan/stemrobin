# Figure quality gate

Start with purpose: can a student use this figure with the edition question and
still be misled about the mathematical relationship?

## Deterministic checks

- source PNG hash is current
- all object ids and references resolve
- every required mathematical relationship has an assertion
- every centrally symmetric object has complete opposite-point pairs whose
  midpoint is the declared center
- assertions pass within declared tolerance
- visible labels use English
- output hash matches render metadata
- every hybrid image reports centered contain fitting with preserved aspect ratio
- no label collision, clipping, missing point, or missing object

## Visual checks

- compare the full edition text, original PNG, and rendered output together
- verify counts, signs, units, relative positions, equal intervals, and labels
- verify no answer is revealed
- verify no cultural text or symbols leaked from the source
- inspect at full resolution and at normal app width
- reject black or visually broken raster rendering

## Repair loop

Allow one targeted repair:

- wrong mathematics: repair FigureSpec coordinates or assertions
- overlap: repair label constraints or canvas composition
- wrong artwork: regenerate only the artwork

If the second result still defeats the instructional purpose, mark
`review.status` as `fail` and stop. Never hand-edit renderer output.
