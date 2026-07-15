# IntentMill Handoff

## Actual Changes

Translation flow (all under `.agents/skills/sr-math-lesson/scripts/`):

- `check-i18n.mjs` (new) — deterministic gate `validateI18n({ zh, en, id })` + CLI. Enforces: node coverage `en == zh` exactly; entry shape `{ t:string, src_rev:int }`; KEY-secrecy (reuses `KEY_FIELDS`, rejects `correct_index`/`accept`/`answer`); formula fidelity (ordered `$…$`/`$$…$$` span list byte-identical zh↔en); inline-SVG fidelity (`<svg>…</svg>` blocks byte-identical — SVG is neutral); markup fidelity (HTML tag multiset identical after stripping neutral spans); residual-CJK (no Han/CJK on the translated surface, with SVG/math text exempt).
- `translate-lesson.mjs` (new) — per-lesson producer/saver mirroring `migrate-lesson.mjs`: `--emit` writes the `zh` worksheet `refs/translation/src/<id>.json`; save mode reads the authored `refs/translation/en/<id>.json`, runs the gate (hard-fail, never persists on any problem), builds `{ node_id:{ t, src_rev:<zh src_rev> } }`, and idempotently upserts ONLY `sr_lesson_i18n(locale='en')`; `--dry` runs the gate with no DB write (author self-check).
- `translate-all.mjs` (new) — thin driver (mirrors `migrate-all.mjs`) to `--emit` or gate-and-save all 16.
- `check-content.mjs` (modified, 1 line) — added `export` to the existing single `KEY_FIELDS` definition so the gate imports the SSOT list instead of duplicating it. No behavior change (regression-confirmed: CLI + `validateContent` unchanged).

Data: 16 `en` overlays authored (parallel per-lesson subagents, each self-checked against the `--dry` gate and iterated until pass) and persisted to `sr_lesson_i18n(locale='en')` — 2626 nodes total. Authoring worksheets/outputs live under `.intentmill/tickets/STEMROBIN-23-en-translation/refs/translation/{src,en}/`.

Tests: `.intentmill/tickets/STEMROBIN-23-en-translation/tests/check-i18n.test.mjs` (12 cases, `node --test`) + `test-results.md`.

No `app/` code, no Dockerfile, no schema (`ssot-schemas/db-schemas/stemrobin.sql`) change.

## How formulas + KEY are kept out of / consistent across the overlay

- KEY never enters an overlay by construction (the saver only writes the authored prose string as `t`), and the gate re-rejects any `correct_index`/`accept`/`answer`. The answer KEY lives only in the neutral base (`sr_lessons.content`/`exercises`).
- Formulas are inline `$…$`/`$$…$$` inside prose (the migration stored prose as full HTML; there are no separate `formula` nodes). Fidelity = the ordered `$…$` span list is byte-identical zh↔en per node — verified across all 2626 nodes (0 differ). Inline `<svg>` blocks and figure `{kind:svg}` nodes are neutral: byte-identical / never in the figure overlay.

## Empirical Verification (gate6)

All run against the shared Azure Postgres `stemrobin-schema` via the server-only `db.mjs`.

- (a) `select count(*) from sr_lesson_i18n where locale='en'` → **16** (OK).
- (b) Per-lesson coverage: `en` node_id set == `zh` node_id set → **16/16 exact** (0 missing, 0 extra).
- (c) KEY grep over all 16 `en` overlays (regex + per-entry field check for `correct_index`/`accept`/`answer`) → **0** (OK).
- (d) SVG neutral-base witness: `math-s2-01` has 1 `{kind:svg}` node in `sr_lessons.content` and its `en` overlay contains **no** `<svg>` (svg stays in the base). `math-s3-01-model-b2` (an inline-svg prose node, 1687-byte `<svg>` with Chinese `<text>` labels) is **byte-identical** between the `zh` and `en` overlay (neutral, untranslated).
- (e) Formula byte-equality: sample `math-s2-01-ex01` zh `["$3a$"]` == en `["$3a$"]`; aggregate over every node → **2626 equal / 0 differ** (OK).
- Compatibility (before/after md5 fingerprints): `zh` overlays (16) **unchanged**; neutral base `content`+`exercises` (16) **unchanged**; `sr_questions` (331 rows) **unchanged**; `sr_users` (2 rows) **unchanged**; `en` rows **0 → 16** (purely additive).
- Unit: `node --test check-i18n.test.mjs` → **12/12 pass**. Full 16-lesson `--dry` gate sweep → **16/16 PASS**.
- Sample `en` rendering (math-s2-01): `ex01` = "What does $3a$ mean?" (src_rev 1); `explain-b1` = `<p>Buy 1 pen &rarr; $3\times 1$; buy 2 pens &rarr; $3\times 2$; …</p>`.

## Spec And Plan Alignment

Implementation matches `im-spec.md` (R1–R9) and `im-plan.md` phases. Coverage of the internal contract:

- Spec obligations: R1 (16 en rows) ✓; R2 (coverage==zh) ✓; R3 (`{t,src_rev}`, src_rev from zh) ✓; R4 (no KEY) ✓; R5 (formula/SVG/markup byte-identical) ✓; R6 (no CJK residue) ✓; R7 (gate is a hard precondition — the saver `fail()`s and never persists on any problem) ✓; R8 (additive `on conflict do update`, only `sr_lesson_i18n('en')`) ✓; R9 (no new dep, no external translation API — only Node stdlib + existing `postgres`) ✓.
- Critical existing contracts preserved: overlay prose-only + KEY-secrecy; neutral-base/overlay split; server-only `db.mjs`; idempotent gated save. Verified by the compatibility fingerprints.
- Non-scope/rejected options absent: no `app/` change, no Dockerfile, no schema change, no third-party API, no new dependency, `zh`/base/`sr_questions`/`sr_users` untouched.
- Test obligations from `im-plan.md ## Unit Test Plan`: all mapped in `test-results.md ## Coverage Map`.

Deviations from `im-plan.md` (both still satisfy `im-spec.md`):

1. Added `export` to `check-content.mjs`'s existing `KEY_FIELDS` (plan said "reuse by import"; the const was not exported). Chose SSOT-preserving export over duplicating the list. Additive, no behavior change, regression-confirmed.
2. Added a `--dry` gate-only mode to `translate-lesson.mjs` (not in the plan) as the author/subagent self-check surface. It only reads + gates; it strengthens (does not weaken) the produce→review→save discipline.

## User Review Points

None blocking. One non-blocking product observation (consistent with the settled charter/seed decisions, recorded for visibility):

- A few source formulas embed natural-language Chinese via KaTeX `\text{…}` inside `$…$`/`$$…$$` (e.g. `math-s2-01` `$$\text{总价}=3\times n$$`, `math-s2-07` `\text{第一棒：去括号}`), and the single inline SVG (`math-s3-01-model-b2`) has Chinese `<text>` labels + `aria-label`. Per binding decision G8 / plan D15 (formulas and SVG are language-neutral, inherited byte-for-byte, never translated), these stay Chinese in the `en` rendering by design. This is the decided behavior, not a defect. Flagged because it is the one place the "English" rendering will still show source-language text.

## Residual Issues And Future Improvements

- Staleness re-translation workflow (detect `overlay.src_rev < base node rev` and re-emit) is not built — not needed now (all nodes `rev=1`); the schema contract and `src_rev` plumbing support it.
- Locales beyond `en` (target 7–8) reuse this flow unchanged (emit worksheet → author → gate → save); no schema change required.
- Future clean-up (would require touching the neutral base, out of this ticket's additive scope): promote `\text{…}`-embedded natural-language labels and inline-SVG `<text>`/`aria-label` out of the neutral formula/graphic so they become translatable, so the observation above disappears.
- Process note (not a product issue): async authoring subagents showed environment flakiness (some isolated-worktree output files were reclaimed after the agent terminated, and subagent-side DB saves were not always visible in the main environment). Resolved by running the authoritative idempotent `translate-all.mjs` save from the main environment while all 16 gate-passing `en` files were present, then verifying the final state directly against the shared DB. Final state is fully verified above.
