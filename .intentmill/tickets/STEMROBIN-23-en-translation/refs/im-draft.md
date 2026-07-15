# IntentMill Draft

## Source

- ticket key: STEMROBIN-23-en-translation
- ticket id: STEMROBIN-23
- `.intentmill/tickets/STEMROBIN-23-en-translation/meta.json` — read (branch, worktree confirmed).
- `.intentmill/tickets/STEMROBIN-23-en-translation/intent.md` — read as raw original user input (delivery ticket full text + live charter + evodocs pointers).
- `AGENTS.md` — read (thin router to `.prodfarm/charter/` engineering-rules; obeyed: SSOT, surgical, no hand-written `sr_*` rows, answer-key secrecy, `.env` never staged).
- `.prodfarm/charter/` — read via intent injection: goal.md (multilingual first locale = en), redlines.md (#2 no polluting prod data; only add `en` rows), engineering-rules.md, architecture.md, runbook.md.
- `.evodocs/modules/module-index.json` present; read substantive modules: `.evodocs/modules/mod--content-generation--math-courseware.md`, `.evodocs/modules/mod--database-schema.md`. (`mod--app--domain-services.md` reviewed for the answer-key-secrecy invariant; this ticket touches no `app/` code.)
- Design context (main checkout, decided): `.tmp/seed-drafts.md` (§架构定调 G5/G8, 草案5), `.tmp/plan-card-reading.md` (§2 多语言, §11 clean-design, D7/D13/D15).
- Code inspected: `.agents/skills/sr-math-lesson/scripts/` — `db.mjs` (server-only Postgres, schema-bound), `migrate-lib.mjs` (how the `zh` overlay + neutral base were built), `migrate-lesson.mjs` (zh upsert path + prose-diff discipline), `check-content.mjs` (`ANCHORS`/`SUBSTANTIAL`, `validateContent`, `validateItemKey`, `KEY_FIELDS` overlay-secrecy check), `save-ledger.mjs`. Schema SSOT: `ssot-schemas/db-schemas/stemrobin.sql` (JSONB contract lines 199-295: `sr_lessons.content/exercises`, `sr_content_ledger`, `sr_lesson_i18n`).
- Live DB inspected read-only (via `.agents/skills/sr-math-lesson/scripts/db.mjs`, the established server-only path — this repo has no separate `nf-db` tool; content-skill DB access is `db.mjs`/psql per charter runbook): 16 lessons have `content` JSONB; 16 `sr_lesson_i18n` rows, all `locale='zh'`, 0 `en`.
- No external docs / Context7 needed: the binding decision forbids any third-party translation API; no new external interface is introduced.
- No frontend `DESIGN.md` needed: this ticket changes no `app/` UI (the reader/locale switch is STEMROBIN-24).

## Draft Spec

After delivery the following must be true:

1. A repeatable translation flow exists under `.agents/skills/sr-math-lesson/scripts/` that produces an `en` locale overlay for a lesson from its `zh` source overlay, following the established produce → independent-review → deterministic-save discipline. It adds no `app/` code, no Dockerfile change, no new dependency, and calls no third-party translation API.
2. Each of the 16 migrated lessons has a queryable `sr_lesson_i18n` row with `locale='en'` whose overlay covers exactly the same translatable node_ids as its `zh` overlay: card prose (`-b*`), SVG captions (`-cap*`), read-check prompts + options (`-rc*`, `-rc*-o*`), and exercise prompts + options (`-ex*`, `-ex*-o*`).
3. Every `en` overlay entry is prose-only `{ "t": "<english>", "src_rev": <the zh source node rev> }`. The overlay contains NO answer KEY field (`correct_index` / `accept` / `answer`) — structurally guaranteed because KEY lives only in the neutral base (`sr_lessons.content` / `.exercises`), never in any overlay.
4. Math formulas (inline `$...$` KaTeX), inline HTML markup, SVG, and numeric literals are inherited from the neutral base, not translated: within each node the ordered set of `$...$` spans and the HTML tag set in the `en` string is byte-identical to the `zh` string; the neutral-base `svg` markup (in `sr_lessons.content`) appears in neither the `zh` nor the `en` overlay.
5. A deterministic gate refuses to persist an `en` overlay that (a) misses or adds any node_id vs the `zh` source, (b) alters any `$...$` formula or HTML tag, (c) contains a KEY field, or (d) leaves untranslated CJK residue in a translated string.
6. The `zh` overlays, the neutral base JSONB, `sr_questions`, and `sr_users` are unchanged; only `locale='en'` rows are added.

## Draft Plan

Rough direction (reuses existing helpers; no new library):

- Add `check-i18n.mjs` (the deterministic gate): given a `zh` source overlay and a candidate `en` overlay, return `string[]` problems — node coverage equality, per-node `$...$`-span list equality, per-node HTML-tag-multiset equality, KEY-field absence (reuse `KEY_FIELDS` from `check-content.mjs`), and residual-CJK detection on translated values. Export `validateI18n` and provide a CLI like `check-content.mjs`.
- Add `translate-lesson.mjs` with two modes mirroring `migrate-lesson.mjs`:
  - `--id <id> --emit`: read the `zh` overlay from `sr_lesson_i18n`, write a source worksheet `refs/translation/src/<id>.json` = `{ node_id: zh_string }` for the author (me / a subagent) to translate into `refs/translation/en/<id>.json` = `{ node_id: en_string }`.
  - `--id <id>` (save): read the `zh` overlay + the authored `refs/translation/en/<id>.json`, run `validateI18n` (hard gate — refuse on any problem), build overlay `{ node_id: { t, src_rev: <zh src_rev> } }`, and `insert ... on conflict (lesson_id,'en') do update` into `sr_lesson_i18n`. Idempotent; touches no other table.
- Add `translate-all.mjs` (thin driver mirroring `migrate-all.mjs`) to save all 16 in one run.
- Produce the 16 `en` translations by authoring (parallel per-lesson subagents), then independently review prose fidelity before the deterministic save. The deterministic gate mechanically guarantees the acceptance-critical invariants (coverage, formula fidelity, KEY-free).

## Code And Evodocs Findings

- **Overlay shape (live DB, `math-s2-01`)**: 151 nodes. Categories by id suffix: prose `-b*` (28), exercise prompts `-ex*` (18), read-check prompts `-rc*` (8), options `-o*` (96, both exercise and read-check), SVG caption `-cap*` (1). Every value is `{ t: string, src_rev: int }`.
- **Formulas are inline, not separate nodes**: `content` body node kinds are `prose` (28) + `svg` (1); there are no `formula`-kind nodes. All math is inline `$...$` KaTeX inside prose HTML strings, e.g. `<p>买 1 支 → $3\times 1$；买 2 支 → $3\times 2$……</p>`. Consequence: the `en` overlay unavoidably carries the same inline `$...$` (prose is stored as full HTML); fidelity means the `$...$` spans and HTML tags must be byte-identical to `zh`, not that formulas are absent from the overlay. This is the single most important implementation constraint and the gate's core check.
- **SVG is the clean "neutral-base-not-overlay" witness**: in `migrate-lib.mjs` `htmlToCards`, a `<figure><svg>` becomes a neutral `{ kind:'svg', svg }` node in `content`; only its `<figcaption>` becomes overlay prose via `caption_id`. So `<svg` markup lives in `sr_lessons.content` and appears in no overlay — the acceptance "formula/SVG in the neutral base, not the overlay" is demonstrated with the SVG markup (grep `<svg` in content = present, in `en` overlay = absent).
- **KEY secrecy is structural**: `migrate-lib.mjs` never writes `correct_index`/`accept`/`answer` into an overlay entry; `check-content.mjs` `KEY_FIELDS` rejects any overlay entry carrying a KEY field. The `en` overlay reuses the same prose-only shape, so KEY-free is guaranteed by construction and re-checked by the gate.
- **`src_rev` / staleness contract** (schema lines 259-272): staleness ⇔ `overlay.src_rev < neutral-base node rev`, or node absent. All migrated base nodes are `rev=1` and every `zh` overlay entry is `src_rev=1`. The `en` overlay records `src_rev` = the `zh` source entry's `src_rev` (the base revision translated from) → `1` today, keeping the staleness comparison uniform across locales.
- **Persistence discipline** (evodocs `mod--content-generation--math-courseware`, `mod--database-schema`): all writes go through a deterministic saver over the server-only `db.mjs`; never hand-write `sr_*`. The `en` saver follows the same `insert ... on conflict do update` idempotent pattern as `migrate-lesson.mjs`'s `zh` upsert, and writes ONLY `sr_lesson_i18n(locale='en')`.
- **DB access**: no `nf-db` tool in this repo; content skills use `.agents/skills/sr-math-lesson/scripts/db.mjs` (server-only, `search_path="stemrobin-schema"`, reads root `.env`) — the charter-sanctioned path. Skill deps installed via `.agents/skills` (`npm install`, `postgres` present).
- R-UI: no user-visible surface changes in this ticket (scope excludes `app/`); the locale switch/reader is STEMROBIN-22/24. No peer-app UI research applies. The learner-facing consequence (English rendering) is verified at the data layer, not via a rendered page.
- R-EXT: no new/unfamiliar external interface — third-party translation APIs are explicitly forbidden; the only external system is the already-contracted shared Azure Postgres accessed through `db.mjs`.
- R-TEST: dev-time verification is deterministic node gate scripts + psql proofs against the shared DB (the content skills have no vitest runner; `app/` vitest is out of scope). Obstacle: translation content is authored, so the "unit" surface is the gate (`check-i18n.mjs`) plus per-lesson gated saves; verification is empirical (psql: 16 `en` rows, node coverage equals `zh`, KEY grep = 0, formula/SVG in base not overlay) captured in `im-handoff.md`.

## Assumptions

- A-1: The `en` overlay must mirror the full `zh` node_id set (every translatable node), not a subset — the acceptance requires cards, read-checks, and exercises all covered. Low risk; matches acceptance criterion 1.
- A-2: `src_rev` in the `en` overlay = the `zh` source entry's `src_rev` (base revision translated from), = 1 today. Low risk; consistent with the schema staleness contract.
- A-3: "No KEY in the overlay" is satisfied structurally by the prose-only overlay shape; the gate re-verifies. Low risk; matches `check-content.mjs` `KEY_FIELDS`.
- A-4: Inline `$...$` formulas and HTML tags riding inside prose strings are acceptable in the `en` overlay provided they are byte-identical to `zh` — because prose is stored as full HTML and formulas were never separated into their own nodes at migration time. RESOLVED (grill D-FORMULA-FIDELITY): formula fidelity = per-node `$...$`-span + HTML-tag byte-equality zh↔en enforced by `check-i18n.mjs`; the SVG (in `sr_lessons.content`, not the overlay) is the demonstrated neutral-base-only witness. Grounded in seed G8 + plan D15.
- A-5 (grill D-EN-SRC-REV): `en` entry `src_rev` = the corresponding `zh` entry's `src_rev` (= 1 today). A-6 (grill D-COVERAGE-SET): `en` node_id set must equal the `zh` node_id set exactly.

## Risks

- DB/schema: writing must be additive only (`locale='en'` rows). A wrong upsert target could touch `zh`. Mitigation: saver hard-codes `locale='en'` and only `insert ... on conflict (lesson_id,'en')`; verify `zh` row `updated_at`/content unchanged before and after.
- Content fidelity: an author could accidentally translate inside a `$...$` (e.g. localize a word in `\text{}`) or drop a tag. Mitigation: `check-i18n.mjs` fails the save on any `$...$`-span or tag-multiset mismatch; residual-CJK check catches untranslated leftovers.
- Acceptance-impacting ambiguity: "formulas equal the zh source (not translated/altered) — verify by checking formulas live in the neutral base, not the overlay." RESOLVED in grill (D-FORMULA-FIDELITY): the demonstrable neutral-base-vs-overlay witness is the SVG; formula equality is proven by `$...$`-span byte-equality between `zh` and `en`, enforced by the gate.
- R-TEST: no automated test runner for the skills; verification is deterministic scripts + psql. Mitigation: the gate script is itself the executable check; capture psql proofs in `im-handoff.md`.
- Scale/quality: 16 lessons × ~150 nodes ≈ 2400 strings to translate. Risk of uneven English quality. Mitigation: per-lesson authoring + independent fidelity review + deterministic gate; acceptance is coverage + fidelity + KEY-free, all mechanically checkable.

## Grill Required

completed
