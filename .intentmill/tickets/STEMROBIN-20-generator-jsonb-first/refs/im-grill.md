# IntentMill Grill

> Full delegation (seed STEMROBIN-18, release=full delegation; prodfarm cap13 self-adjudication).
> No human is in the loop for this batch. Each blocking decision below is ruled from the charter
> (`.prodfarm/charter/`), the ticket intent, the STEMROBIN-19 JSONB schema contract
> (`ssot-schemas/db-schemas/stemrobin.sql`), and the decided design docs
> (`.tmp/seed-drafts.md` §架构定调 G1/G5/G6/G7/G8 + 草案2; `.tmp/plan-card-reading.md` §11 + D1/D5/D13/D14/D15).
> `final_decision` records the ruling + its basis. A genuine PRODUCT decision the charter/intent
> could not settle would be flagged here as a grill-leak — there are none.

## Blocking Decisions

1.
- id: D-OVERLAY
- question: To render readable HTML "from the JSONB", must the generator author the `zh` source prose overlay (`sr_lesson_i18n`, locale='zh') and have the renderer join neutral `content` + `zh` overlay, or may it inline learner-visible prose directly inside `content.cards[].body[]` nodes so `content` alone is renderable?
- recommendation: Author the `zh` source overlay and join at render. `content.body[]` prose nodes are node-id refs whose text lives in the overlay; formulas (KaTeX), SVG, and numeric literals stay neutral and inline in `content`. All learner-visible math prose (card bodies, read-check prompts/options, exercise prompts/options) goes to the `zh` overlay uniformly.
- final_decision: RULED — author the `zh` source overlay; renderer joins neutral `content`/`exercises` + `zh` overlay. Basis: (1) the STEMROBIN-19 schema contract is explicit — `stemrobin.sql:226-227` says card `body[]` prose nodes are "node-id refs (text in overlay)" and `:259-265` says "zh is the SOURCE locale and is itself an overlay row" holding ONLY prose; the task's binding decision "honor the exact JSONB shapes documented in stemrobin.sql" makes this contract authoritative. (2) `.tmp/plan-card-reading.md` §11 干净设计原则 #1/#2 forbids "leftover compromise" and mandates "i18n 模式全局统一" across card/read-check/exercise prose. (3) charter `engineering-rules.md` #5 (SSOT, one canonical path). (4) STEMROBIN-23 (translation) can only ADD an `en` overlay if the `zh` source overlay already exists; inlining prose now would force STEMROBIN-21/23 to restructure it. Authoring the `zh` overlay is source authoring, not translation, so it stays within this ticket's generator scope. This is settled by schema + design docs — not a grill-leak.

2.
- id: D-SUBSTANTIAL
- question: Which card anchors count as "substantial" and therefore must carry ≥1 `read_check`?
- recommendation: Substantial = the genre teaching anchors that are genuine reading targets: 概念课 motivation/model/anatomy/boundary/connections; 方法课 motivation/explain/examples/connections. Exclude `oral` (itself a self-quiz, not reading) and the 练习课 `motivation` orientation (no new content). Generate ≥1 read-check per substantial card; each read-check is answerable from that card alone.
- final_decision: RULED — substantial = all teaching anchors except `oral` and the 练习课 orientation; each gets ≥1 read-check answerable from the card alone. Basis: `.tmp/plan-card-reading.md` §3 D1 ("只给实质卡：motivation/model/anatomy/boundary…；跳过 oral / 练习课") and D2 (read-check bounded to the just-read card); the ticket acceptance requires "every substantial card has num + ≥1 read-check". connections is included as a reading target (it carries taught content) which strictly satisfies the acceptance; oral/orientation exclusion follows D1. Settled by the design docs.

3.
- id: D-SAMPLE-OUTLINE
- question: How is the disposable sample authored without polluting the real catalog or violating the human-outline fidelity contract, and does the outline-fidelity check (`check-outline.mjs`) still gate real content?
- recommendation: Use a disposable id on a disposable stage that maps to NO human course-guide entry (e.g. `math-sample-jsonb-first` / a sample stage). For a disposable sample, the human-outline fidelity check is not applicable (it exists to keep real curriculum ids/titles/order in sync with `resources/content/course-gen-guide-math.md`); it remains enforced for real stages. Delete all sample rows after proof.
- final_decision: RULED — disposable sample id on a disposable stage; outline-fidelity check is N/A for the sample and REMAINS enforced for real stages; sample rows deleted after verification. Basis: the task mandates "use a clearly-disposable sample lesson id … and DELETE the sample rows after verification"; charter `engineering-rules.md` #3 (surgical) + `mod--content-generation--math-courseware` establish outline fidelity as a guard for REAL curriculum ids, which a throwaway id does not map to; seed G3/D12 authorizes disposable content data (only the `sr_users` credential row is untouchable), and redline #2 is respected because the sample is written then deleted (no accumulated prod data polluted). Settled by task + charter.

4.
- id: D-EXERCISE-MODE
- question: Does the exercises deck stay choice-only (current pedagogy) or adopt the schema's full `mode` set (choice|input|work)?
- recommendation: The `exercises` shape validator accepts the schema's full `mode` set (choice|input|work) with the matching `key` shape (`{correct_index}` | `{accept}` | `{answer}`), so the JSONB contract is honored; the representative sample deck uses choice-first (the established math pedagogy). Composition rules (16–24 items, layer shares, 复习 tail + review_of closure) are preserved.
- final_decision: RULED — validator honors the full schema `mode` set; sample deck is choice-first; existing composition rules preserved. Basis: `stemrobin.sql:234-240` documents `exercises.items[].mode` ∈ choice|input|work and `key` ∈ {correct_index}|{accept}|{answer}; honoring the exact shape is a task binding decision. Current pedagogy is choice-first (SKILL.md commitment #4 "choice-only, exactly 4 options"; `scripts/backfill-choice-decks.mjs` evidences the choice migration; D14 keeps read-check to choice+input). Keeping the validator permissive to the schema while the sample uses choice avoids weakening either the contract or the pedagogy. Settled by schema + code evidence.

5.
- id: D-KEY-PLACEMENT
- question: Where do the answer KEY and the post-answer reference answer/explanation live, and how is KEY-secrecy proven?
- recommendation: `correct_index`/`accept`/`answer` live ONLY in the neutral-base `key` (content.read_check[].key and exercises.items[].key). They are excluded from BOTH the `zh` overlay AND the rendered HTML / practice projection. cap6 greps the rendered HTML to prove no KEY leaked.
- final_decision: RULED — KEY (incl. the `answer` reference/explanation) stays neutral-base `key` only, absent from the overlay and from rendered HTML; proven by an empirical KEY grep in cap6. Basis: `stemrobin.sql:205-207,229-230,262-269` — KEY lives only in the neutral base and the overlay "MUST NEVER contain an answer KEY"; charter `engineering-rules.md` "Answer-key secrecy" + `mod--database-schema` "Answer-key secrecy is a schema-plus-service invariant"; seed G5. The existing `renderPractice` in `save-lesson.mjs` already emits prompts+options only (never `answer`/`correct_index`/`accept`) and is the reusable KEY-free projection. Settled by schema + charter.

6.
- id: D-DERIVED-CACHE
- question: Does the rebuilt saver keep writing `sr_lessons.html` and `sr_lessons.pdf` as derived caches?
- recommendation: Yes — the renderer writes `sr_lessons.html` (+ best-effort `sr_lessons.pdf`) as DERIVED caches of the JSONB, so the existing app reader/PDF-download path keeps working with zero `app/` change. The `content`/`exercises`/overlay JSONB remain the SSOT; html/pdf are regenerable.
- final_decision: RULED — renderer writes derived `sr_lessons.html`/`pdf` caches from the JSONB SSOT; no `app/` change. Basis: `stemrobin.sql:199-200,220` "html/pdf on sr_lessons remain DERIVED caches; SSOT for content = these columns"; seed G1 ("HTML/卡片视图/PDF … 全部 render(jsonb)"); the ticket constraint "changes NO app/ code" requires the existing reader (which reads `sr_lessons.html`) to keep working, which the derived cache satisfies. Settled by schema + intent.

## Recommended Defaults

- Reuse the existing `assets/lesson-template.html` head/shell verbatim (DESIGN teal/green/white tokens, KaTeX CDN wiring, `data-sr-section`/`sr-sec-num`/`sr-sec-name`, print/answer rules) as the render target, so the derived HTML stays consistent with the current reader and no new DESIGN.md decision is needed.
- Reuse the closure algorithm of `check-ledger.mjs` and the composition rules of `check-exercises.mjs` (refactor their cores so the DB-ledger path and validators share one implementation — SSOT, one way), rather than reimplementing them.
- Ledger authoring persists to `sr_content_ledger (subject, stage, ledger, src_rev)` via a deterministic saver (upsert on PK `(subject, stage)`); content/exercise authoring and the validators read the ledger from that table by `(subject, stage)` — no local ledger file is read (satisfies acceptance #3).
- Stable card/read-check/exercise node ids are generator-assigned and stable across idempotent re-saves; `rev` is the per-node source revision the overlay's `src_rev` compares against for staleness (initialized on first author).
- `sr_content_answer_events` is a learner-runtime table; the generator does not write it.
- Internal file layout of the new scripts (e.g. `save-ledger.mjs`, `render-lesson.mjs`, `check-content.mjs`, whether the saver is one file or split) is implementation latitude for cap5/cap6, not a user decision.

## Future Or Conditional Decisions

- `en` translation overlay + translation gate (STEMROBIN-23): only the `zh` SOURCE overlay is authored here; producing/validating an `en` overlay is a later ticket.
- Migration of the 16 existing lessons and the 2 on-disk stage ledgers (`resources/content/math-ledger/stage-2.json`, `stage-3.json`) into JSONB SSOT (STEMROBIN-21): out of this ticket; the on-disk files simply stop being the generator's read source here, and are not deleted here.
- Card-by-card reading UI + soft-gate flow that consumes `read_check[]` at runtime (STEMROBIN-22).
- If `playwright-core` cannot launch a browser engine in cap6, the PDF is best-effort; since acceptance requires a real PDF, cap6 confirms the engine launches or records a `## Blocker` in `im-handoff.md` (no fabricated PDF).
- Post-merge evodocs drift: `mod--content-generation` / `--math-courseware` describe the pre-rebuild HTML-first `sr_questions` pipeline; reconciling those docs is an n-evodocs concern after merge, not an edit in this ticket.

## Out-of-Scope Guardrails

- No `app/` code change, no `Dockerfile` change, no `app/src/lib/curriculum.ts` edit — generator scope only.
- No new dependency and no new recurring cost (charter redline #3); skill scripts continue resolving `postgres`/`playwright-core` from `.agents/skills/node_modules`.
- Do not delete or alter the `sr_users` credential row or the 16 real lessons' existing data; sample writes use a disposable id/stage and are deleted after proof (charter redline #2, seed D12).
- Do not migrate existing content, build the reading UI, or produce any `en` translation in this ticket.
