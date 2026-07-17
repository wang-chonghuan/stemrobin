# purpose

The database-schema module is StemRobin's durable contract for learner identity, math curriculum content, localization, reading and practice events, attempt state, progress summaries, and retained biography data. It creates and evolves tables inside the quoted `stemrobin-schema` namespace of the shared PostgreSQL database. The browser never receives database credentials; application server functions and content saver scripts are the only normal readers and writers.

The schema reflects an active migration rather than one uniform storage model. Math courseware is JSONB-first: stage ledgers, neutral card trees, neutral exercise decks, and prose overlays are authoritative, while HTML and PDF are derived caches. Practice still has relational question rows and answer events because those ids drive the attempt-aware quiz. Content-node events and compact practice score rows support reading and overview progress. Story tables remain available even though the deployed application no longer exposes biography routes.

Several product guarantees depend on understanding these relationships. Answer keys may be stored but must not enter overlays or initial browser payloads. Deterministic lesson ids connect curriculum order to content and progress. Locale overlays must cover every referenced node before a lesson appears. Cascades define which learner history disappears when content or attempts are replaced.

# structure

`sr_users` is the identity root. It stores a numeric id, unique email, scrypt hash, and creation timestamp. The application signs the numeric id into an HTTP-only cookie; there is no database session table. All answer, attempt, and progress rows reference this user and cascade on deletion.

`sr_lessons` is the math lesson identity and artifact row. It stores deterministic id, subject, stage/order coordinates, title, concept, status, derived HTML, optional derived PDF, and timestamps. Additive alterations introduce `content` and `exercises` JSONB. Those JSONB columns are neutral authorities: prose is represented by node ids, formulas and SVG may remain inline, and hidden keys stay in the neutral base.

`sr_content_ledger` stores one ledger JSON document per subject and stage plus source revision and update time. It owns the machine-readable curriculum plan used by the math saver: lesson ids, genres, concepts, vocabulary dependencies, and boundary cases. `sr_lesson_i18n` stores one prose-only overlay per lesson and locale, mapping stable node ids to text and source revision. It cascades with the lesson.

`sr_questions` remains the relational practice deck. Each row has lesson, order, cognitive type, prompt, answer mode, visible options, hidden correct index or accepted forms, composition layer, review target, and hidden explanation. The unique lesson/order pair establishes deck order. `sr_answer_events` records relational question responses and can link each event to a quiz attempt.

`sr_quiz_attempts` groups one pass through a lesson deck. It stores learner, lesson, start time, and nullable end time. Open attempts support resume; ended attempts support scorecards. The later `attempt_id` alteration on answer events cascades so deleting an open attempt during restart removes its events.

`sr_content_answer_events` stores answers against JSONB node identities rather than relational question ids. It records learner, lesson, kind, node id, correctness, selected index or typed text, locale, and timestamp. Current application reading uses `kind='read_check'`. These rows are deliberately disposable and cannot use a foreign key to a JSONB item.

`sr_practice_attempts` stores a scored percentage for a learner and lesson. It is separate from `sr_quiz_attempts`: the quiz attempt reconstructs item-level state, while the practice row is the compact progress signal. SQL constrains scores to zero through one hundred. Application code retains only the newest two rows per learner/lesson.

The retained biography family consists of `sr_stories`, `sr_story_chapters`, `sr_story_questions`, and `sr_story_answer_events`. Stories store public-domain provenance; chapters store Markdown, stage grouping, global section ranges, PDF, and status; questions and events use a separate id space. These tables remain writable by the biography skill but have no current application consumer.

# flows

Schema application uses the server-only easy-app connection string and sets the project search path. The file combines `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. It can create a fresh schema and add the documented JSONB or attempt-link columns to an existing deployment. More complex future transformations still require deliberate migration SQL.

Math curriculum production first upserts a stage ledger. Lesson persistence reads that ledger, validates neutral content, exercises, and the source overlay, renders HTML/PDF, then upserts the lesson row and Chinese overlay. Translation tooling adds another overlay only after exact coverage and fidelity checks. Rerendering updates only derived HTML/PDF from the current ledger, JSONB, and source overlay.

At runtime, locale availability enumerates all prose, caption, read-check, and exercise node ids referenced by a lesson and requires the selected overlay to contain them. Card reading joins the lesson JSONB to the active overlay and projects key-free cards. Correct read-check submissions write content answer events for authenticated learners. The hidden key stays in lesson JSONB.

Practice question delivery reads visible relational question columns. For non-source locales, exercise JSONB and overlay text are aligned to relational questions by order. Answer recording reads hidden relational columns after authentication and writes an answer event, optionally linked to a quiz attempt. Restarting deletes an open quiz attempt and cascades its events. Ending stamps the attempt and computes a score against the current relational deck.

The score percentage is then written to `sr_practice_attempts`. The writer inserts a new row and prunes all but the latest two for the learner and lesson. Progress reads every lesson's current read-check ids, the learner's distinct correct content events, and the latest practice score. Reading contributes one point only when every current check is correct; practice contributes one point when the latest score is at least eighty.

Biography saver flows can still upsert stories, chapters, questions, and PDFs. Question replacement and parent deletion cascade their dependent events. Because no current route reads this family, database validity does not imply current product visibility.

# module-relationships

The math-courseware generator is the main upstream writer. It owns ledger validation, JSONB shape validation, overlay key secrecy, relational deck synchronization, rendering, translation, and cache rebuilding. The schema provides storage and broad relational constraints but does not validate JSONB internals or educational meaning.

The application domain-services module is the runtime consumer and learner-state writer. It authenticates against users, selects locale-complete lesson content, judges hidden keys, manages quiz attempts, writes content and relational events, stores compact practice scores, and aggregates progress. The learner-experience module sees only its server projections.

The curriculum outline in application code is a companion contract. Deterministic lesson ids turn persisted rows into catalog links and navigation. The human course guide and database ledger are upstream intent and machine-plan sources; the schema does not derive titles or order from them automatically.

The runbook owns operational application of this file through `psql`. There is no separate migration framework or version table. Changes therefore need explicit coordination among DDL, deployed database shape, content savers, application services, and existing data.

# constraints

The schema file is the source of truth for durable shape. New columns, tables, indexes, cascades, and checks belong here and must be applied server-side. Do not create shadow table definitions in application or content artifacts. Preserve the quoted project schema and keep credentials out of the browser.

Answer-key secrecy spans storage and services. Neutral JSONB and question rows may contain keys, but overlay rows must be prose-only, rendered HTML must be key-free, and initial fetches must omit hidden columns. Correctness remains a server decision.

Foreign-key cascades define data lifetime. Deleting a lesson removes overlays, questions, content events, quiz attempts, practice scores, and question-linked events. Deleting an open quiz attempt removes its linked events. Replacing relational questions can destroy answer history. These consequences must be intentional.

Important invariants remain code-enforced: JSONB shape, stable node ids, complete overlay coverage, companion fields for each answer mode, exact choice policy, ledger closure, latest-two practice retention, story section continuity, and deterministic lesson-id consistency. A constraint-valid direct insert can still be invalid product content.

# known-limits

The persistence model is hybrid. Neutral exercises and overlays coexist with relational questions, and order is their alignment key for localized practice. There is no database constraint proving they represent the same deck. A partial writer can create a mismatch that only appears in the learner UI.

The DDL is additive but not a general migration system. `ADD COLUMN IF NOT EXISTS` handles selected evolution, but it cannot transform old data, tighten existing constraints safely, rename columns, or version multi-step migrations. There is no schema-version ledger.

Draft status is stored but current lesson reads do not use it as a publication gate. Persisted rows may become visible when ids and locale coverage qualify. Publication remains an operational convention rather than enforced access control.

Progress and answer data are intentionally lossy. Content events have no foreign key to JSONB nodes, only the latest two practice scores are retained, and relational question replacement can cascade old events. The model supports current feedback, not immutable longitudinal analytics.

Biography tables are orphaned from the current app. They remain valid storage for the biography saver but can drift from runtime expectations without an active consumer.

# notes-for-ai

Before changing a table, map every writer and reader. For math content, trace ledger save, lesson save, translation, rerender, locale availability, card projection, practice localization, answer judgment, attempts, and progress. For identity, trace password verification, signed cookies, and every user cascade. For story tables, account for the absence of a current route.

Use explicit migration SQL for existing deployments and test against a realistic pre-change schema. Reapplying create statements is not enough for transformations. Preserve data lifetimes unless the product requirement deliberately changes history retention.

Never bypass content savers with direct SQL. They enforce prerequisite closure, JSONB shape, overlay coverage, rendering, and key separation that PostgreSQL does not. If a new writer is necessary, give it equivalent validation before production use.

Verify both storage and behavior after changes. Exercise locale availability, card reading, key-free payloads, one read-check event, a resumed and ended quiz attempt, score recording, progress aggregation, PDF retrieval, and relevant cascades in a disposable database. Confirm that schema changes do not expose keys or split the deterministic lesson identity across tables.
