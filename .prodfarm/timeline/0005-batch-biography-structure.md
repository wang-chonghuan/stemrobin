# 0005 batch — 0002-biography-structure

- kind: batch
- anchor: .prodfarm/batches/0002-biography-structure/
- author: human (intent given; grill rulings delegated to machine with a conservative/align-with-product policy)

## Selection & direction rationale
Evolve the existing 名人传记 feature (sr-story / `/story/$id`) so a biography reads like a real book: 阶段 → 章 → 节, with **globally continuous section numbers** across the whole biography (a reader can cite "§N" and locate it fast), and each chapter downloadable as a PDF **the same way math lessons print** (pre-rendered PDF + download button). Two stories, a linear chain: S1 builds the structure/print mechanism and converts the existing 3 Ford chapters; S2 extends the Ford biography with ≥3 new chapters continuing the numbering. Aligns with the existing `story-page` feature and the math-lesson print pattern — no new mechanisms, minimal schema change (one `pdf` column).

## Deferred
None.

## Veto handling
None (no prior proxy decisions to veto).

## Charter changes at this boundary
None. This batch evolves an existing feature and introduces no charter change; no redline hit (no destructive external writes — the re-saved Ford chapters are `status='draft'`, user-requested, reproducible from the public-domain source; no spend; `goal.md` untouched). No spec_diff fan-out.

## Grill note
All cap7 rulings were made by the machine under the human's explicit conservative-delegation ("遇到 grill 采取保守、对齐现有产品的方针,尽量不打扰"). Full record in `batches/0002-biography-structure/grill.md`. Key conservative rulings: print = mirror the math PDF (not a new print mechanism); stage grouping = reuse the catalog stage pattern (no new table); global numbering enforced by the saver; D1+D2 merged into S1 so the mechanism story is black-box acceptable.
