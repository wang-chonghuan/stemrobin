# purpose

The math-courseware module is StemRobin's JSONB-first production system for concept-led math lessons. It turns a human-approved curriculum into a database ledger, neutral card-tree lessons, neutral exercise decks, locale-specific prose overlays, and derived HTML/PDF. Its purpose is not merely to generate pages. It makes prerequisite vocabulary, central mental models, boundary cases, retrieval practice, translation coverage, and answer-key secrecy explicit contracts before content reaches the learner.

The target learner can handle advanced material but needs concepts named and parsed rather than hidden inside procedures. Each stage therefore has one central model, each lesson owns one installable idea and a vocabulary budget, and later lessons may consume only terms that earlier lessons introduced or the ledger explicitly assumes. Exercises include review of earlier terms so retention is authored into the course rather than delegated to a runtime scheduler.

The module is also a content compiler. Neutral JSONB and overlays are source data; HTML and PDF are deterministic caches. Stable node identities allow the same lesson structure and keys to support multiple languages without duplicating formulas, SVG, numeric structure, or answers. The application consumes those contracts for card reading, full-text display, practice, and progress.

# structure

The human math course guide owns stage direction, lesson titles, and order. A stage ledger expands that intent into subject, stage, theme, central model, assumptions, and ordered lesson entries. Each lesson entry includes deterministic id, genre, status, core idea, introduced terms, consumed terms, and boundary cases. The ledger is authored as scratch JSON, validated, and persisted in `sr_content_ledger`; capabilities that author or save lessons read it back from PostgreSQL.

Neutral lesson content is an ordered card tree. Cards have stable ids, learner-visible numbers, section display names, genre-specific anchors, revisions, body nodes, and read-checks. Prose body nodes reference overlay ids. Formulas and inline SVG remain neutral. Figure captions are overlay prose. Read-check prompts and visible options are overlay prose, while correct indexes or accepted forms remain in the neutral `key`.

Neutral exercises are ordered items with stable ids, cognitive type, composition layer, optional review target, mode, revision, visible option references, and a hidden key. The source-locale overlay is shared across lesson and exercise prose ids. The current `CHOICE_ONLY` policy narrows both card checks and exercises to single-answer choice questions, with exactly four pedagogically plausible options required by the skill contract. Input and work branches remain in schema, application, renderer, and validators so the policy can be reversed without a data-model rewrite.

Deterministic validators enforce different layers of correctness. Ledger checks enforce schema, identity, term ownership, order, and prerequisite closure. Content checks enforce genre anchor order, card names and numbers, substantial-card read-check coverage, node uniqueness, overlay coverage, and key-free overlay entries. Exercise checks enforce deck size, contiguous order, cognitive role shares, review closure, and allowed modes. Translation checks require exact node coverage and preserve formulas, SVG, and HTML tags while rejecting keys or untranslated CJK prose.

The renderer consumes metadata, content, exercises, and one overlay. It produces self-contained HTML with numbered named sections, resolved body prose, key-free card checks, and a consolidated key-free practice section. It never reads item keys. PDF generation uses the same HTML and is best effort through Playwright. The lesson saver coordinates validation, rendering, and database upserts. Separate utilities migrate old HTML/relational decks, translate overlays, restore section names, backfill choice decks, and rerender caches.

# flows

Stage work starts with the human guide. The author creates or revises one ledger and runs closure plus outline-fidelity checks. A genuine prerequisite gap must be visible in assumptions rather than smuggled into later prose. Saving the ledger compares the prior database document, advances its source revision when content changes, and upserts the stage row. This database row becomes the machine authority for subsequent lesson work.

Lesson authoring reads the relevant ledger entry and available earlier vocabulary. Concept lessons establish and parse a category through examples, non-examples, anatomy, boundary cases, connections, and oral recall. Method lessons derive a move from its principle, work examples, connect backward and forward, and require explanation. Practice lessons introduce no new concepts. Every substantial teaching card carries a read-check. Section display names and learner-visible card numbers are part of the neutral content contract.

An independent lesson gate reviews pedagogical meaning rather than JSON shape. It checks whether the central model is actually taught, vocabulary is introduced before use, examples support parsing and reasoning, declared boundary cases are covered, and prose fits the target learner. Deterministic checks then verify the machine contract. If new terminology is required, the repair belongs in the ledger before lesson persistence.

Exercise authoring follows a passed lesson. The deck has sixteen to twenty-four items and balances identification, operation, error diagnosis, reasoning, and review. Review items refer to earlier ledger terms. Under the current choice-only policy, read-checks and exercises use four options with one correct answer and three same-kind distractors tied to nameable misconceptions. The hidden explanation remains in the neutral key or relational persistence path and is not rendered into learner-facing HTML.

Persistence accepts lesson id, content JSON, exercise JSON, and source overlay. The saver parses stage/order from the id, reads the database ledger, confirms the entry and order, validates content and exercises, and checks human-outline fidelity for real lessons. It renders HTML and best-effort PDF, then upserts lesson metadata, neutral JSONB, derived caches, status, and the Chinese overlay. Re-running the same stable ids is an intentional overwrite rather than a second version.

Translation begins from the Chinese overlay. The target overlay must contain exactly the same ids. Formula spans and SVG blocks must be byte-identical, markup shape must be preserved, key fields are forbidden, and translated prose may not retain Chinese characters outside neutral spans. A validated overlay is upserted for the target locale. The application later treats incomplete coverage as unavailable rather than mixing languages.

Migration utilities can structurally extract old lesson sections and relational decks into cards, exercises, and a Chinese overlay without rewriting prose. Rerender utilities read current ledger, JSONB, and source overlay from the database and rebuild HTML/PDF through the canonical renderer. Rerendering changes only derived caches; it must not mutate neutral content, exercises, overlays, or users.

# module-relationships

The content-generation parent supplies the shared author-review-validator-saver discipline. This child owns math-specific ledger closure, model-first lesson genres, card checks, deck composition, translation contracts, migration, and rendering. Biography source provenance and narrative rules do not belong here.

The human guide is upstream intent, while `sr_content_ledger` is downstream machine authority. The static application curriculum is a companion consumer of the same titles and deterministic ids. A title or order change therefore needs coordination across human guide, saved ledger, generated lesson metadata, localized title maps, and catalog order.

The database-schema module owns storage. `sr_lessons.content` and `exercises` are neutral authorities; `sr_lesson_i18n` owns prose overlays; `sr_content_ledger` owns the stage plan; `sr_questions` supplies current relational practice identity; `sr_content_answer_events`, relational answer events, quiz attempts, and practice attempts belong to runtime learning state. HTML and PDF on the lesson row are derived caches.

Application domain services consume cards plus overlays for reading, relational questions plus exercise overlays for localized practice, and stored HTML/PDF for full-text and download. Complete overlay coverage controls catalog availability. Stable read-check ids feed reading progress, while practice attempt scoring feeds the second progress point.

# constraints

Preserve the authority chain: human guide, database ledger, neutral lesson/exercise JSONB, locale overlays, derived HTML/PDF, runtime projections. Do not make a cache or local migration file the source of truth. Never hand-write lesson rows; use the saver so validation, rendering, metadata, and overlays remain synchronized.

Prerequisite closure is mandatory. Consumed terms must already exist in assumptions or earlier introductions, and each introduced term has one owner. Boundary cases declared in the ledger must appear in teaching and exercises. Genre anchors, card numbers, section names, and stable node ids are behavioral contracts, not incidental formatting.

Answer keys stay in neutral base data or privileged relational columns. Overlays contain prose only. Rendered HTML can show prompts and options but never correct indexes, accepted forms, or explanations. Translation must preserve neutral math and graphics exactly.

Choice-only is a reversible policy, not permission to delete other-mode support. Change it at the policy owner and update validation/generation expectations together. Do not create a parallel hard-coded mode list in another script.

# known-limits

The skill contract and some older reference text still reflect earlier exercise assumptions, so agents must follow the current top-level choice-only policy and policy script rather than stale examples. Deterministic validators cannot prove distractor quality or that a lesson genuinely teaches its central model; semantic gates remain necessary.

The runtime practice path is hybrid. Exercise JSONB supplies neutral/localized text, while relational questions supply ids and hidden scoring fields. Their order must remain aligned. Replacing relational decks can remove dependent answer history.

PDF generation is best effort. A save or rerender may keep an older PDF when browser launch fails. Translation currently covers learner-visible prompt text but not every post-answer explanation used by the application.

There is no built-in immutable revision history for lesson JSONB. Stable ids and source revisions support staleness checks, but an upsert replaces the current authoritative document.

# notes-for-ai

Start by identifying which authority the change belongs to. Curriculum intent belongs in the human guide; terms and prerequisite structure belong in the ledger; learning structure and keys belong in neutral JSONB; prose belongs in overlays; visual output belongs in the renderer; learner state belongs in application services and event tables.

For lesson changes, read the current database ledger entry and earlier vocabulary, then validate the complete content/overlay pair. For exercise changes, solve every item, inspect distractor misconceptions, verify review targets, and confirm the current choice policy. Never repair a missing prerequisite only in prose.

For translation changes, compare node sets and source revisions, preserve formula/SVG/markup bytes, and verify application availability after persistence. For renderer changes, use existing JSONB to rerender and compare card mode, full text, PDF, and key-free output.

After saving, verify the actual application: localized catalog visibility, card numbers and names, read-check judgment, full-text section labels, practice prompt alignment, initial payload secrecy, PDF, attempt scoring, and progress. Run deterministic validators before database mutation and keep semantic review independent from the author.
