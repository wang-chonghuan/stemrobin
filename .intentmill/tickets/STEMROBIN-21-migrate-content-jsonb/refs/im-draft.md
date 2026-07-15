# IntentMill Draft

## Source

- ticket key: STEMROBIN-21-migrate-content-jsonb
- ticket id: STEMROBIN-21
- `meta.json`: read (batch 0004-jsonb-card-reading, seed STEMROBIN-18, full delegation).
- `intent.md`: read as the raw original user input (enabler: migrate the 16 real math lessons + stage ledgers into the JSONB SSOT WITHOUT re-authoring prose).
- `AGENTS.md`: read (thin router; engineering rules live in `.prodfarm/charter/engineering-rules.md`, which is injected into intent.md §二).
- `.prodfarm/charter/`: goal/redlines/engineering-rules/architecture/runbook are injected verbatim into `intent.md` §二 and were obeyed. Key redlines: #2 (no polluting/destroying accumulated prod data beyond authorized answer events), #4 (do not touch goal.md). Only the 2 `sr_users` rows are the hard-preserve.
- `.evodocs/modules/module-index.json`: read. Substantive modules used: `mod--content-generation--math-courseware`, `mod--database-schema`, `mod--app--domain-services` (all injected into `intent.md` §三 and read in full).
- code areas inspected (repo-root-relative):
  - `ssot-schemas/db-schemas/stemrobin.sql` — the T1 (STEMROBIN-19) JSONB CONTENT SSOT block: `sr_lessons.content`/`exercises`, `sr_content_ledger`, `sr_lesson_i18n`, `sr_content_answer_events`, and the documented internal JSONB contract.
  - `.agents/skills/sr-math-lesson/SKILL.md` + `scripts/{db,ledger-core,save-ledger,check-content,check-exercises,render-lesson,save-lesson}.mjs` — the T2 (STEMROBIN-20) JSONB-first generator/validator/renderer I must reuse.
  - `.agents/skills/sr-math-lesson/references/common/lesson-contract.md` — genre section anchors / substantial-card set (via check-content constants).
  - `resources/content/math-ledger/stage-2.json`, `stage-3.json` — the local ledgers to migrate; source of per-lesson `genre`.
  - live DB (read-only inspection): all 16 `sr_lessons` rows (html present, content/exercises NULL, status draft), `sr_questions` decks (18–24 items, all `choice`), `sr_content_ledger` (EMPTY), `sr_lesson_i18n` (empty), `sr_users` (2 rows).
- external docs (`find-docs`/Context7): none needed. No new external API/SDK/cloud interface. The only external system is the shared Azure Postgres, reached through the repo's established server-only client `.agents/skills/sr-math-lesson/scripts/db.mjs` (mirrors `app/src/lib/db.ts`); its behavior is already established in-repo.
- `nf-db`: this repo has no `nf-db` tooling; the charter-mandated DB path is the server-only `postgres` client in `db.mjs`/`app/src/lib/db.ts` (schema `stemrobin-schema`). All DB work goes through `db.mjs`. Read-only inspection was used for the draft; mutations happen only in cap6 via the deterministic engine.
- frontend `DESIGN.md` (`resources/reference/DESIGN.md`): not authored against — this ticket changes NO `app/` code and designs no new UI surface. The re-rendered lesson HTML reuses the existing generator template `.agents/skills/sr-math-lesson/assets/lesson-template.html` (already DESIGN-conformant); no new hues/tokens introduced.

## Draft Spec

Intent: make the DB JSONB the authoritative content for the 16 REAL production math lessons and the two stage ledgers, WITHOUT re-authoring prose, reusing T2's render/validate capability, so the current iframe reader keeps working from re-rendered HTML.

Scope (confirmed by intent + code facts):
- Migrate the two local ledgers `resources/content/math-ledger/stage-{2,3}.json` into `sr_content_ledger` via the existing `save-ledger.mjs` (closure-validated). After this, the local files are no longer authoritative.
- For each of the 16 lessons (`math-s2-01..08`, `math-s3-01..08`): parse `sr_lessons.html` into a card-tree `content` JSONB keyed by `<section data-sr-section>`, EXCLUDING the deck-injected `practice` section; cards ordered + numbered from 1; card anchors exactly equal the genre's anchor set.
- Convert each lesson's existing `sr_questions` deck into the `exercises` JSONB (`{items:[…]}`) per the T1 contract: `{id, ord, type, mode, layer, review_of, key, rev}` with choice `key={correct_index}`; prompt + option TEXT go into the `zh` overlay by node id.
- Generate ≥2 read-checks per SUBSTANTIAL card (concept: motivation/model/anatomy/boundary/connections; method: motivation/explain/examples/connections; practice-genre: none) — new authored content, choice/input, answer locatable within the card just read.
- Fill the source-locale overlay `sr_lesson_i18n(locale='zh')` with all translatable prose (card body prose, read-check + exercise prompts/options, svg captions). KEY (`correct_index`/`accept`/`answer`) never enters the overlay.
- Re-render `sr_lessons.html` + `pdf` FROM the JSONB via `render-lesson.mjs`, and upsert `sr_lessons.content/exercises/html/pdf` + `sr_lesson_i18n(zh)`.
- Per lesson: emit an original-HTML snapshot + a diff so the governor can audit that prose is unchanged / only split-adjusted.

Non-scope:
- No re-authoring of lesson prose or formulas; only structural extraction (+ minimal split adjustment if ever needed — [assumption: NOT needed, see Findings]).
- No `app/` code change; no card-reading UI (draft 4), no translation/`en` (draft 5/6), no progress consumption.
- No fixing the stage-2 outline conflict (STEMROBIN-17) — ledger data moves as-is.
- Do NOT delete `sr_questions` (the current app quiz still reads it); do NOT touch the 2 `sr_users` rows.

Compatibility requirements:
- The current iframe reader must still render a migrated lesson (re-rendered self-contained HTML with KaTeX, responsive, practice projection).
- Migration is idempotent (re-run overwrites, not appends; stable node ids; on-conflict upsert).
- Answer events tied to replaced content are disposable (authorized).

State/data requirements: content/exercises JSONB on `sr_lessons`; one `sr_lesson_i18n(zh)` overlay row per lesson; two `sr_content_ledger` rows; original html snapshots + diffs on disk (audit artifacts, git-ignored scratch or committed refs).

## Draft Plan

Rough direction (reuse-first; details finalized in cap5):
- Add a dedicated, idempotent migration capability under the existing skill (`.agents/skills/sr-math-lesson/scripts/migrate-*.mjs`) rather than a new top-level tool, reusing `db.mjs`, `render-lesson.mjs`, `validateContent`, `validateExercises`, `save-ledger.mjs`. Do NOT reuse `save-lesson.mjs` as the entry point because it runs the human-outline fidelity gate, which stage-2 fails by known contract conflict (STEMROBIN-17) — the migration must bypass that gate while still reusing the lower-level validate/render pieces.
- Deterministic engine, two logical stages: (1) parse each lesson's html into `{cards:[…]}` body nodes + zh overlay and convert `sr_questions`→`exercises`; snapshot original html; (2) after read-checks are authored, merge them, run `validateContent` (must pass) + `validateExercises` (informational), render html/pdf, upsert, write diff.
- HTML parsing: split each teaching `<section>` into its DIRECT child elements via a depth-counting splitter (no new dep); map `<figure><svg>` → neutral `svg` node (svg markup shared cross-locale, caption→overlay), every other block (`p`, `div.sr-step/sr-example/sr-note/sr-pitfall/sr-eg/sr-answer`, `h3`, `ol.sr-oral`, `ul.sr-links`, `table`) → a prose node rendered verbatim.
- Renderer gap: `render-lesson.mjs renderBodyNode` supports prose roles note/pitfall/h3/default (`<p>`-wrapped) only; the old lessons carry block structures that must render verbatim. Add ONE backward-compatible prose role `html` that emits `t` verbatim (unwrapped). This is the minimal necessary extension so DERIVED HTML reproduces the original block structure; new T2-authored lessons are unaffected.
- Ledger migration: `save-ledger.mjs --ledger stage-{2,3}.json` (closure only; no outline gate).
- Read-check authoring: author ≥2 per substantial card from the card's own prose (parallel per-lesson authoring + one review pass), then feed into stage (2).
- Verify (cap6): psql proof for all 16 (cards, ≥2 read-checks/substantial card, exercises items, ledger rows), no-KEY-in-html grep, and the app rendering a migrated lesson in the browser.

## Code And Evodocs Findings

Evidence (code authoritative):

- T1 JSONB contract (`stemrobin.sql`): `content = {cards:[{id,num,anchor,rev,body[],read_check[]}]}`; body nodes are prose (id→overlay), formula (neutral tex), or svg (neutral inline, caption_id→overlay). `read_check[] = {id, mode:choice|input, key, rev}`. `exercises = {items:[{id,ord,type,mode,layer,review_of,key,rev}]}` with choice `key={correct_index}`, input `{accept}`, work `{answer}`. Overlay `= {node_id:{t,src_rev}}`, prose only, NEVER a KEY. `sr_content_ledger PK(subject,stage)`; `sr_lesson_i18n PK(lesson_id,locale)`.
- `check-content.mjs` (the enforcement point) requires: card anchors EXACTLY equal the genre anchor set in order; every card has integer `num` (unique, contiguous from 1) + integer `rev` + non-empty `body`; each SUBSTANTIAL card ≥1 read_check; overlay entries are `{t,...}` with NO key field. Genre anchor/substantial sets: 概念课 anchors=motivation/model/anatomy/boundary/connections/oral, substantial=first five; 方法课 anchors=motivation/explain/examples/connections/oral, substantial=first four; 练习课 anchors=[motivation], substantial=[].
- `render-lesson.mjs`: renders cards + a `practice` section projected from `exercises` (prompts+options only — never `key`, preserving answer secrecy). Prose `t` is emitted RAW for note/pitfall/default; option/prompt text resolved from overlay. `renderBodyNode` has no branch for arbitrary block markup → the `html` role gap noted in the plan.
- `save-lesson.mjs` runs `validateContent` + `validateExercises` + (real stages) the human-outline fidelity check before mutating. The outline check is why migration must NOT route through it for stage-2 (STEMROBIN-17 conflict; evodocs `mod--content-generation--math-courseware` "known-limits" confirms the stage-2 ledger fails the outline checker). `save-ledger.mjs` runs only closure (`validateLedger`), which the evodocs says the stage-2 ledger passes → ledger migration is safe.
- Live DB facts: 16 lessons all `content/exercises` NULL, html 19–32 KB, status draft; `sr_content_ledger` EMPTY; `sr_lesson_i18n` empty; `sr_users`=2. Decks: all `answer_mode='choice'`, 18–24 items, layers 指认/操作/辨错/说理(/复习), types ⊆ {辨认,表示,操作,反推,辨错,说理}. First lessons of a stage (s2-01, s3-01) carry no 复习 (consistent with closure). `sr_questions.answer` holds a hidden explanation with no slot in the exercises contract.
- HTML structure (all 16 sampled): teaching sections match their genre anchors EXACTLY (verified for all 16 — clean split; no D10 adjustment needed). Inline math is raw `$...$` (KaTeX auto-render). Block vocabulary inside sections: `p`, `div.sr-step`, `div.sr-answer`, `div.sr-example(+ .sr-example-h)`, `div.sr-pitfall`, `div.sr-eg`, `div.sr-note`, `ol.sr-oral`, `ul.sr-links`, `figure.sr-fig` (all have `<svg>`), `h3`, one `table.sr-table`; 12 display `$$…$$` occurrences (inside blocks); no section-level `<style>`. The trailing `<section data-sr-section="practice">` is the deck projection → excluded.

R-UI (compatibility surface, not a new design): the only user-visible surface is the re-rendered lesson HTML shown in the app's existing sandboxed lesson iframe (`app/src/routes/_app/lesson.$id`, per `mod--app--domain-services`). Peer/established pattern is this repo's own generator output: `render-lesson.mjs` + `assets/lesson-template.html` already produce DESIGN-conformant lesson HTML (KaTeX CDN, three-color tokens, print rules). The migration reuses that exact renderer, so the surface stays consistent by construction; the enumerated touched surfaces are: the lesson reader iframe, the print PDF download, and the in-lesson `practice` projection. No catalog/nav change (ids/subject/stage/order preserved). No new control, route, or copy is authored.

R-EXT: no new/unfamiliar external interface. Postgres via the established `db.mjs` (server-only, `ssl:'require'`, `search_path="stemrobin-schema"`). The upsert-on-conflict operations require UPDATE on `sr_lessons`/`sr_lesson_i18n`/`sr_content_ledger` — the same role/path T2's savers already use successfully, so authorization is established.

evodocs/code agreement: no disagreement found; evodocs `known-limits` (stage-2 outline conflict, disposable answer events, deck replacement destructiveness) match the code and are handled by the plan.

## Assumptions

- The 16 lessons split cleanly on genre anchors so no D10 prose adjustment is needed — VERIFIED against all 16 (low risk; the engine still fails loudly if any lesson's anchors mismatch its genre).
- The existing `sr_questions` decks satisfy their original authoring composition, so `validateExercises` will largely pass; but migration treats it as INFORMATIONAL (faithful move, not re-authoring), so a threshold miss does not block. Low risk.
- Leaving `sr_questions` intact keeps the current app quiz working; `exercises` JSONB is the new SSOT for the future card-reader only. Consistent with "no app/ change".
- The hidden per-choice explanation (`sr_questions.answer`) has no slot in the shipped T1 exercises contract; it is NOT carried into `exercises` (stays in the retained `sr_questions` rows + snapshot), so no content is lost and the contract is not extended. See Risks.
- Audit artifacts (original html snapshot + per-lesson diff) are acceptable as committed files under the ticket refs / a migration output dir. Low risk.

## Risks

- DB/schema (compatibility): re-rendering changes `sr_lessons.html` for all 16 rows in shared prod. Mitigation: snapshot every original html BEFORE mutation (reversible); idempotent upsert; verify the app still renders a migrated lesson.
- Contract gap (data): the exercises contract has no field for the choice explanation. Chosen resolution keeps it out of `exercises` and relies on retained `sr_questions`; if a future card-reader needs explanations in JSONB that is a T1/T2 contract change, out of scope here. Flagged for grill classification.
- Renderer extension: adding the `html` prose role touches T2's `render-lesson.mjs`. Risk of regressing T2-authored lessons — mitigated by making it purely additive (only a new role value; existing roles untouched) and re-rendering a T2 sample if available.
- Answer-key secrecy: option/prompt text goes to the overlay; the explanation must NOT leak into the overlay or html. Mitigation: `check-content` enforces KEY-free overlay; the migration never writes `answer`/`correct_index`/`accept` into overlay; no-KEY-in-html grep at verify.
- Read-check authoring (quality + scope): ~128 new read-checks (64 substantial cards × 2) must be genuinely "did you read this" items with answers locatable in-card. Mitigation: author from each card's own prose + one review pass; deterministic shape gate via `check-content`.
- R-TEST (dev-time testing obstacles): the skill dir has no test runner; the migration hits the SHARED prod Postgres (cannot spin a throwaway DB trivially). Mitigation: unit-test the PURE functions (section splitter, html→nodes, deck→items) offline on the snapshotted html without touching the DB; gate the DB-writing path behind the deterministic validators; run one lesson end-to-end first, then the batch; the browser render check uses `cd app && npm run dev`. No dedicated test account needed (migration is not a logged-in flow; verify render is anonymous; answer-flow secrecy is checked by grep + reused server contract).

## Grill Required

completed

Grill decisions (adjudicated in `im-grill.md` under prodfarm cap13 full delegation, no human): BD1 — migrate `exercises` to the shipped T1 contract as-is (choice `key={correct_index}`, prompt/options→overlay); do NOT carry the choice explanation into JSONB; retain `sr_questions` untouched so nothing is lost. BD2 — mutating the 16 shared-prod rows + 2 ledger rows is authorized within the snapshot-first, idempotent, sr_users-preserving envelope. BD3 — an additive `html` prose role may be added to T2's `render-lesson.mjs` so DERIVED HTML reproduces the original block structure. No genuine product decision required a human; no grill-leak.
