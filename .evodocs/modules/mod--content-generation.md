# purpose

The content-generation module is StemRobin's controlled authoring and persistence layer for educational material. It converts human curriculum intent or public-domain source material into validated database content through agent skills, independent gates, and deterministic saver scripts. It is not a directory the deployed application reads at runtime. The application consumes database rows and derived artifacts after a content workflow succeeds.

The parent currently contains two declared specialist children with different product status. Math courseware is the active end-to-end producer for the deployed learner application. It owns concept ledgers, neutral lesson JSONB, locale overlays, exercise decks, rendering, translation, migration, and persistence. Biography reading still owns a public-domain narrative generation and persistence workflow, but biography routes and readers have been removed from the current application.

The shared reason for this module is controlled publication. An authoring model creates semantic content, a distinct review step evaluates educational or narrative quality, deterministic validators enforce machine-checkable contracts, and a saver performs the database mutation. This separation prevents persuasive generated output from bypassing prerequisite closure, provenance, structural validation, answer-key secrecy, or runtime compatibility.

# structure

The active skill family lives under `.agents/skills` and has its own package dependencies, separate from the web application package and container image. Content scripts resolve the repository root, read the ignored root environment file, connect to the shared PostgreSQL schema, and never expose the connection string. This operational separation keeps authoring tools and browser/runtime dependencies independent.

The math child is JSONB-first. A human course guide establishes stage direction, titles, and order. A stage ledger expands that intent into a central model, prerequisite assumptions, lesson genres, introduced and consumed terms, boundary cases, and review targets. The ledger is persisted in PostgreSQL and becomes the machine authority read by lesson and exercise authoring. Lesson content is a neutral ordered card tree; learner prose lives in locale overlays; hidden answer keys stay in neutral JSONB. Exercise decks use the same neutral-structure and overlay split. HTML and PDF are derived caches rendered from those authorities.

The biography child remains provenance-first. It begins with a public-domain book, converts source material into working text, produces a reader-appropriate outline, authors long-form chapters, generates comprehension and reflection questions, applies a narrative quality gate, and persists story/chapter/question/PDF rows. Its current persistence contract remains meaningful even though no deployed route consumes those rows.

The superseded `sr-lesson` skill remains in the parent as legacy compatibility material. New math work belongs in `sr-math-lesson`. The legacy workflow describes older HTML-centered assumptions and must not become a parallel current source of truth.

Human-authored guides and design references constrain both content quality and presentation. They are inputs to generation, not generated outputs. Temporary worksheets, migrations, and review artifacts are execution aids rather than persistent product contracts.

# flows

Math work begins with the human outline and a checked stage ledger. The ledger validator enforces unique term ownership and prerequisite closure. The saver persists the ledger into `sr_content_ledger`, and later capabilities read it back from the database. This prevents an author from silently using a local stale ledger while persisting lesson content against a different stage plan.

A lesson author creates neutral cards with stable ids, numbers, section names, anchors, revisions, formulas or SVG, and hidden read-check keys. A source-locale overlay carries the actual prose for body nodes, prompts, captions, and options. Validators enforce genre-specific card order, required read-check coverage, contiguous numbering, overlay completeness, and key-free prose. A separate gate reviews whether the lesson actually teaches the ledger's model, terms, boundary cases, and reasoning.

Exercise authoring creates a neutral deck and extends the prose overlay. Deterministic checks enforce item count, cognitive roles, review targets, ordering, mode policy, and valid hidden keys. The current reversible policy restricts generated read-checks and exercises to single-answer choice questions while schema and application support for other modes remains available.

The math saver reads the stage ledger from the database, validates lesson and deck artifacts, checks human-outline fidelity, renders self-contained HTML and best-effort PDF from JSONB, and upserts lesson JSONB, derived caches, and the Chinese overlay. Translation tooling validates exact overlay coverage, formula/SVG/markup preservation, absence of answer keys, and absence of untranslated prose before upserting another locale. Rerender tooling can rebuild stale HTML/PDF caches from current database authorities without changing source content.

Biography work follows its own sequence: public-domain verification, deterministic conversion, outline, chapter, question generation, independent gate, then saver. The saver preserves source provenance and chapter structure. It remains a valid authoring path but no longer has an application verification loop until a consumer is restored.

# module-relationships

The database-schema module defines every final storage contract. Math writes stage ledgers, lessons, overlays, relational questions, and derived caches. Biography writes story, chapter, question, and PDF rows. Runtime answer events and learner progress are downstream application concerns rather than generator outputs.

The application domain-services child is the math consumer. It resolves locale-complete lessons, projects key-free cards and practice text, judges answers, and computes progress. The learner-experience child renders card and full-text modes. Generator changes to node ids, overlay coverage, exercise order, generated head markup, or deterministic lesson ids can therefore affect catalog visibility, reading, practice, and progress.

Human guides are upstream intent. The math course guide precedes the DB ledger, while the ledger becomes the machine contract for generated lessons. Public-domain source URLs precede biography prose and remain stored as provenance. Design references constrain rendered output but do not replace content structure.

# constraints

Final generated content is written only through deterministic saver scripts. Do not hand-edit `sr_*` content rows or create a second publishing route. Secrets remain in the root environment file and server-side scripts. The skill dependency package remains separate from the app package.

Math authority flows from human guide to DB ledger to neutral JSONB and overlays. HTML/PDF are derived. Answer keys remain neutral-base-only and never enter overlays or rendered HTML. Stable node ids and complete overlays are cross-locale contracts, not disposable formatting details.

Biography content requires verifiable public-domain provenance and narrative gating. Because it currently lacks a deployed consumer, persistence success alone does not prove learner-facing usefulness.

# known-limits

The parent contains a superseded math skill whose older assumptions can misroute an agent. The active skill must be selected explicitly for JSONB-first math work.

Math persistence is database-coupled and PDF rendering is best effort. A successful content save may retain an older PDF when browser rendering fails. Translation explanations are not yet fully localized in the application.

Biography generation remains available without a current application route. Its rows and saver contracts can drift from product needs unless a future feature re-establishes runtime verification.

# notes-for-ai

Choose the child skill by the requested product output. Use math courseware for ledgers, lessons, decks, overlays, translations, rendering, or math persistence. Use biography reading only for public-domain narrative authoring. Do not use the legacy math skill without an explicit compatibility reason.

Keep semantic authoring, independent review, deterministic validation, and persistence as separate phases. For math, trace a change through the human outline, DB ledger, neutral JSONB, overlay, renderer, schema, server projection, and browser. For biography, trace provenance, chapter continuity, questions, persistence, and the absence of a current app consumer.

After persistence, verify actual stored math content in both card and full-text modes, PDF output, locale visibility, initial key-free payloads, and representative answer/progress behavior. A validator pass proves structure, not educational quality; a reviewer pass does not replace saver checks.
