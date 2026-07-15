# IntentMill Spec

## Intent

Rebuild the `.agents/skills/sr-math-lesson/` content-generation skill to be **JSONB-first**: the DB JSONB is the single authority for math course content. The generator reads the per-stage concept ledger from the DB, authors a lesson's card-tree content + exercise deck as neutral JSONB plus a source-locale (`zh`) prose overlay, persists them, and renders HTML + PDF as derived caches of that JSONB. Answer KEY stays neutral-base-only and never reaches learner-visible output. This is the establishment point of the JSONB content contract and the render/validate capability that later migration/translation tickets reuse.

## Scope

- The `sr-math-lesson` skill only: `SKILL.md`, `references/`, `scripts/`, `assets/` under `.agents/skills/sr-math-lesson/`.
- Read the per-stage concept ledger from the DB table `sr_content_ledger` (by `subject`, `stage`) — not from any local `resources/content/math-ledger/*.json` file.
- Persist a ledger document to `sr_content_ledger (subject, stage, ledger, src_rev)` via a deterministic saver (so a ledger exists in the DB for content authoring to read).
- Author and persist `sr_lessons.content` (neutral card-tree JSONB) and `sr_lessons.exercises` (neutral exercise-deck JSONB), honoring the exact shapes documented in `ssot-schemas/db-schemas/stemrobin.sql` (the STEMROBIN-19 "JSONB CONTENT SSOT" block).
- Author each substantial card's `read_check[]` items (with neutral `key`) as part of card authoring.
- Author and persist the `zh` source prose overlay to `sr_lesson_i18n (lesson_id, locale='zh', overlay)` (card-body prose, read-check prompts/options, exercise prompts/options), keyed by node_id.
- Deterministically render, from the JSONB, the self-contained lesson HTML and a print PDF, persisted as the DERIVED caches `sr_lessons.html` / `sr_lessons.pdf`.
- Preserve the existing pedagogy contracts: ledger prerequisite-closure check, genre section anchors, and the produce → independent-review → deterministic-save three-phase discipline.
- Prove the rebuild with ONE small representative disposable sample math lesson, then delete the sample rows.

## Non-Scope

- Migration of the 16 existing lessons and the 2 on-disk stage ledgers into JSONB (STEMROBIN-21). The on-disk `resources/content/math-ledger/stage-2.json` / `stage-3.json` files simply stop being the generator's read source here; they are NOT deleted in this ticket.
- The card-by-card reading UI / soft-gate flow that consumes `read_check[]` at runtime (STEMROBIN-22).
- Any `en` (or non-`zh`) translation overlay or translation skill (STEMROBIN-23). Only the `zh` SOURCE overlay is authored here.
- Any `app/` code change, any `Dockerfile` change, any `app/src/lib/curriculum.ts` edit.
- Any new dependency or new recurring/one-off cost above the redline threshold.
- Writing `sr_content_answer_events` (a learner-runtime table).
- Deleting or altering the `sr_users` credential row or the 16 real lessons' existing data.
- Rejected option (do not implement): inlining learner-visible prose directly inside `content.cards[].body[]` so `content` alone is renderable (rejected per D-OVERLAY).

## Requirements

R1. Ledger read source is the DB. Content/exercise authoring and every ledger-dependent validator obtain the ledger from `sr_content_ledger` by `(subject, stage)`. Completing an authoring run must not read any local `resources/content/math-ledger/*.json` file.

R2. Ledger persistence. A deterministic saver validates a ledger document (schema + prerequisite closure + term-ownership uniqueness, per the existing ledger contract) and upserts it into `sr_content_ledger` on PK `(subject, stage)`, setting/advancing `src_rev`. No hand-written rows.

R3. Content JSONB shape (honor `stemrobin.sql` exactly). `sr_lessons.content = { "cards": [ { "id", "num", "anchor", "rev", "body": [...], "read_check": [...] } ] }`:
- `id` is a stable card node id (stable across idempotent re-saves).
- `num` is the learner-visible 编号 present on every card.
- `anchor` is a genre section anchor: 概念课 = motivation/model/anatomy/boundary/connections/oral (in order); 方法课 = motivation/explain/examples/connections/oral; 练习课 = motivation.
- `rev` is the per-node source revision (int).
- `body[]` is ordered neutral nodes: prose nodes are node-id refs whose text lives in the `zh` overlay; formula (KaTeX) and SVG nodes are neutral and inline here.
- `read_check[]` items: `{ "id", "mode": "choice"|"input", "key": {"correct_index":int}|{"accept":[...]}, "rev" }`.

R4. Substantial-card read-check. Every substantial card carries ≥1 `read_check` item. Substantial = the genre teaching anchors that are reading targets: 概念课 motivation/model/anatomy/boundary/connections; 方法课 motivation/explain/examples/connections. `oral` and the 练习课 `motivation` orientation are NOT substantial (no read-check required). Each read-check is answerable from that card's content alone.

R5. Exercises JSONB shape (honor `stemrobin.sql` exactly). `sr_lessons.exercises = { "items": [ { "id", "ord", "type", "mode", "layer", "review_of", "key", "rev" } ] }`:
- `mode` ∈ choice|input|work; `key` ∈ `{correct_index:int}` | `{accept:[...]}` | `{answer:"<reference>"}`, matching `mode`.
- `type` ∈ 辨认|表示|操作|反推|辨错|说理; `layer` ∈ 指认|操作|辨错|说理|复习; `review_of` set only on 复习 items and must be an earlier-lesson/assumed term (closure).
- Composition preserved: 16–24 items; `ord` unique, contiguous from 1; 指认 ≥25%; 操作 ≥20%; ≥2 辨错; ≥2 说理; ≥3 复习 unless stage's first lesson; each ledger `boundary_cases` entry exercised.

R6. zh source overlay. `sr_lesson_i18n (lesson_id, locale='zh', overlay)` holds ONLY prose keyed by node_id: `overlay = { "<node_id>": { "t": "<zh prose>", "src_rev": <int> } }` covering card-body prose nodes, read-check prompts/options, and exercise prompts/options. The overlay MUST NOT contain any `correct_index`/`accept`/`answer` KEY, formula, SVG, or numeric literal (those inherit from the neutral base).

R7. Render from JSONB. A deterministic renderer takes (neutral `content` + neutral `exercises` + `zh` overlay + lesson metadata) and produces the self-contained lesson HTML using the existing `assets/lesson-template.html` head/shell (DESIGN tokens, KaTeX CDN wiring, `data-sr-section`/`sr-sec-num`/`sr-sec-name` structure, print/answer rules). The rendered HTML contains, per card, its `num` label and body; a learner-visible practice/read-check projection shows prompts + options ONLY. The HTML MUST contain NO answer KEY (`correct_index`/`accept`/`answer`).

R8. Derived caches. The saver persists the rendered HTML to `sr_lessons.html` and a best-effort print PDF (via the existing playwright-core path) to `sr_lessons.pdf`, so the existing app reader and PDF-download path keep working with no `app/` change. `content`/`exercises`/overlay remain the SSOT; html/pdf are regenerable derived caches.

R9. Deterministic save + three-phase discipline. Content/exercises/overlay/derived-caches are persisted only after the deterministic shape validators pass (content shape + read-check presence + KEY-secrecy + exercises composition + overlay-has-no-KEY). Authoring is produce → independent review → deterministic save. Saves are idempotent (re-save overwrites, stable node ids).

R10. Sample proof + cleanup. Using the rebuilt generator, author ONE small representative sample math lesson under a clearly-disposable id/stage that maps to no real curriculum slot. After empirical verification (DB JSONB present; HTML + PDF render; no KEY in HTML; ledger read from DB not a file), DELETE every sample row (`sr_lessons`, `sr_content_ledger` sample stage, `sr_lesson_i18n` sample). Never touch `sr_users` or the 16 real lessons.

## Critical Existing Contracts

- **Answer-key secrecy (must not regress).** `correct_index`/`accept`/`answer` are server-only. They live only in the neutral-base `key` and must be absent from the `zh` overlay AND from every learner-visible rendered surface (HTML/practice projection). Basis: charter `engineering-rules.md` "Answer-key secrecy"; `stemrobin.sql:205-207,262-269`; existing `renderPractice` in `save-lesson.mjs` emits prompts+options only.
- **Genre section anchors (fixed, ordered, validated).** 概念课 motivation/model/anatomy/boundary/connections/oral; 方法课 motivation/explain/examples/connections/oral; 练习课 motivation. The current saver validates the anchor set per genre (`save-lesson.mjs:89` `ANCHORS`); the card-tree `content.cards[].anchor` and the renderer reuse exactly this set and order.
- **Ledger prerequisite closure + term-ownership uniqueness.** Every `consumes` term must be introduced by an earlier lesson or in `assumed`; each term is introduced by exactly one lesson (`check-ledger.mjs`). This closure algorithm must be preserved and now runs against the DB-sourced ledger.
- **Exercise composition rules.** The item-count / layer-share / 复习-tail / review_of-closure rules in `check-exercises.mjs` must be preserved for the new `exercises.items[]` shape.
- **Deterministic-save-only persistence.** Content rows are written only through the skill's saver scripts, never hand-written (charter `engineering-rules.md`; `mod--content-generation` constraints). DB access is server-only via the `postgres` client reading `.env` `EASYAPP_DATABASE_URL` with `search_path="stemrobin-schema"`, ssl require; skills resolve deps from `.agents/skills/node_modules`.
- **Derived HTML cache contract.** The app reader consumes `sr_lessons.html`; the rebuilt saver must keep populating a valid `sr_lessons.html` so no reader change is needed.
- **Idempotent upsert keys.** `sr_content_ledger` PK `(subject, stage)`; `sr_lesson_i18n` PK `(lesson_id, locale)`; `sr_lessons` conflict on `id`.

## Confirmed Decisions

- D-OVERLAY: Author the `zh` source prose overlay; the renderer joins neutral `content`/`exercises` + `zh` overlay. Prose = node-id refs in overlay; formulas/SVG/numeric literals stay neutral+inline in `content`. (Rejected: inlining prose in `content.body`.)
- D-SUBSTANTIAL: Substantial cards (needing ≥1 read-check) = all teaching anchors except `oral` and the 练习课 orientation; each read-check answerable from its card alone.
- D-SAMPLE-OUTLINE: The sample uses a disposable id on a disposable stage mapping to no human-guide entry; the human-outline fidelity check is N/A for the sample but REMAINS enforced for real stages; sample rows are deleted after verification.
- D-EXERCISE-MODE: The `exercises` shape validator accepts the schema's full `mode` set (choice|input|work) with matching `key`; the representative sample deck is choice-first; composition rules preserved.
- D-KEY-PLACEMENT: The answer KEY, including the post-answer reference answer/explanation (`key.answer`), stays in the neutral-base `key` only — absent from the overlay and from rendered HTML; proven by an empirical KEY grep in cap6.
- D-DERIVED-CACHE: The renderer writes derived `sr_lessons.html` and best-effort `sr_lessons.pdf` from the JSONB SSOT; no `app/` change.
- Recommended defaults adopted: reuse `assets/lesson-template.html` head/shell verbatim; reuse and share (do not reimplement) the `check-ledger.mjs` closure algorithm and `check-exercises.mjs` composition rules; generator-assigned stable node ids; `rev`/`src_rev` initialized on first author; generator does not write `sr_content_answer_events`.
- Guardrails: generator scope only (no `app/`/`Dockerfile`/`curriculum.ts`); no new dependency / recurring cost; do not touch `sr_users` or the 16 real lessons; do not migrate existing content, build the reading UI, or translate.

## Compatibility And Regression Constraints

- The existing app reader/PDF path (reads `sr_lessons.html` / `sr_lessons.pdf`) must keep working unchanged — the rebuilt saver keeps populating a valid derived HTML (+ best-effort PDF).
- The 16 existing `sr_lessons` rows and their `sr_questions`/`sr_answer_events` are untouched by this ticket; the sample uses a disposable id/stage so no real row is modified or deleted.
- `sr_users` credential row is never read, modified, or deleted.
- No change to the DB schema (`ssot-schemas/db-schemas/stemrobin.sql`) — this ticket consumes the STEMROBIN-19 structures as-is.
- Answer-key secrecy invariant preserved end-to-end (overlay + rendered HTML both KEY-free).
- No new npm dependency; skill dep set (`postgres`/`marked`/`playwright-core`) unchanged.

## Open Questions

None.
