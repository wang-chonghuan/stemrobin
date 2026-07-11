# purpose

The database-schema module is StemRobin's durable contract for learner identity,
generated courseware, biographies, quiz keys, and learner attempts. It creates
the PostgreSQL tables in the project-specific `stemrobin-schema` namespace and
defines which information survives beyond a browser session or a generated
content file. The schema is intentionally product-oriented: a lesson is stored
as a complete reader artifact with its printable PDF; a biography chapter is
stored as Markdown with a source-backed place in a story; questions hold both
the learner-visible prompt and the server-only answer material; and answer
events preserve the relationship between a learner and a particular question
identity.

The module is not a generic persistence layer. It encodes the division between
the math and biography learning experiences. Math has HTML lessons, typed
answers, conceptual layers, and review targets. Biography has public-domain
story provenance, chapter stages, globally cited sections, and choice or open
reflection questions. They share learner identity and a broad answer-event
shape, but their question tables and event tables are deliberately separate
because their content contracts, answer modes, and foreign-key targets differ.

The database also supports several product promises that future changes must
preserve. Content delivery is database-driven rather than a static-file lookup.
Lesson catalog availability comes from saved deterministic ids. Quiz answers are
not sent to a browser before a learner responds. Story source URLs persist with
the story rather than being an external note. Parent content rows, child
question rows, and learner attempts have cascading lifetimes. Understanding
those relationships is necessary before modifying a saver, adding analytics,
changing publication status, or migrating a table.

# structure

The DDL establishes the quoted `stemrobin-schema` search path and creates eight
tables. It assumes a plain PostgreSQL access model: the application and content
savers hold the connection string on the server, while the browser never gets a
database credential. There is no browser-facing PostgREST or row-level-security
layer in this design. The application database client also selects this schema
explicitly, uses TLS, and recycles idle or old connections so an Azure-held
connection is not reused after a long pause.

`sr_users` is the small identity root. It stores an identity-generated numeric
user id, unique email, scrypt password hash, and creation timestamp. Password
verification happens in server code, and the current login mechanism then
places only a signed user id in an HTTP-only cookie. There is intentionally no
database session table, token row, or user-profile hierarchy at this stage.
Every answer-event table points back to this numeric identity, so deleting a
learner deletes that learner's answer history through foreign keys.

The math family begins with `sr_lessons`. A row has a string id, subject,
stage/order coordinates, title, core concept, self-contained HTML, optional
pre-rendered PDF, status, and timestamps. The `(subject, stage, lesson_order)`
constraint prevents two lesson rows from claiming the same curriculum position.
The HTML is the actual reader artifact, not a pointer to a file: it includes
the lesson's rendering setup and, after deck persistence, an injected practice
section. The PDF is stored as bytes so the application can return it without
re-rendering when a learner asks to download it.

`sr_questions` is the math deck child of a lesson. Its unique
`(lesson_id, ord)` ordering keeps an individual deck sequence unambiguous. It
stores the question type and prompt together with answer-mode-dependent
material: choices can have options and a hidden index, typed questions can have
hidden acceptable forms, and work questions use an explanatory reference answer
after an attempt. The `layer` and `review_of` columns carry the pedagogical role
of a question, including the review targets used for spaced retrieval. The
schema restricts the answer mode to `choice`, `work`, or `input`, but it does
not itself require that exactly the appropriate companion columns are populated.

`sr_answer_events` records an attempt against a particular math question. Its
`is_correct` value is a boolean for scored choices and typed answers, or null
for a work response; `chosen` stores the original option index and
`answer_text` stores the submitted typed text. The future-facing
`answer_blob_id` slot has no active upload or review flow. Indexing by user and
question supports looking up a learner's attempts, while foreign keys connect
the event to both the learner and the current question identity.

The biography family begins with `sr_stories`, whose row carries a stable slug,
title, person, era, public-domain source URL, status, and timestamps.
`sr_story_chapters` owns the ordered chapters of a story. It stores Markdown
instead of HTML, optional stage label and order, the start and end of the
story-wide section range, optional printable PDF, and status. The application
renders this trusted Markdown on the server when it serves a chapter. The
`(story_id, ord)` constraint prevents duplicate chapter positions but does not
derive or validate global section continuity; that is controlled by the story
saver.

`sr_story_questions` mirrors the concept of a math deck but permits only
`choice` and `work` modes. Its question id space is independent from math
questions, and `sr_story_answer_events` therefore has its own foreign key
target, answer history, and index. A story answer event can record a selected
option or an ungraded work attempt. Public-domain provenance lives on the
parent story row, so every persisted chapter remains linked to the source
contract its authoring workflow requires.

# flows

Schema application begins from the project root with a server-only PostgreSQL
connection string. The DDL selects `stemrobin-schema` and creates absent tables
and indexes. The app's `sql()` client uses the same schema at runtime, accepts
the local authoring connection variable or the deployed container's database
variable, and retains a reusable server-side client. A failed connection string
is surfaced as a server error; there is no browser fallback or parallel
database.

Authentication starts with an email/password lookup in `sr_users`. The
application compares the submitted password against the stored scrypt hash and,
on success, signs the numeric user id into an HTTP-only cookie. Later answer
operations verify that cookie, look up only the required answer data in the
appropriate question table, and insert an answer-event row only for a known
logged-in learner. No table stores browser sessions, so the cookie signature
rather than a session-row lookup controls the active login state.

Math content is written in two ordered operations. The math content saver first
upserts a lesson row after its authoring pipeline has checked curriculum and
ledger metadata. This makes the lesson HTML, any generated PDF, and its stable
id available to the reader and catalog. The deck save then reads that existing
lesson, rebuilds a practice section from the entire supplied deck, updates the
stored HTML and PDF, deletes all existing `sr_questions` rows for the lesson,
and inserts the replacement sequence. The question deletion matters beyond the
current deck: the event table has `ON DELETE CASCADE`, so every learner attempt
attached to a replaced question is deleted with it.

For a learner starting a math quiz, the initial question read selects only id,
order, type, prompt, answer mode, and options. It intentionally leaves
`correct_index`, `accept`, and `answer` in the database. Choice submissions are
compared against the hidden index. Typed submissions are normalized in
server-side code and compared against hidden acceptable forms. Work submissions
record a null correctness value. Only after the operation records the event
does the server return the explanation and, for a choice, the correct original
option index. The client may shuffle display order, but it maps the selection
back to the database's original index before the server evaluates it.

Biography production starts by upserting a provenance-bearing story, then
upserting one chapter with its Markdown, stage grouping, global section range,
PDF, and status. The saver validates the chapter's numbered H2 structure and
checks its first section against the maximum preceding chapter range for that
story. It then deletes the chapter's prior story questions and inserts the new
question sequence. As with math, cascading foreign keys delete the old answer
events with the question rows. The catalog queries stories and chapters
separately, groups chapters using stage metadata, and exposes their stored
section ranges. The reader converts stored Markdown to trusted HTML on the
server, and the story quiz follows the same answer-key hiding pattern with its
own question/event tables.

The application makes content visible from row existence rather than from a
separate publication transaction. The lesson catalog takes all saved lesson ids
and overlays them onto the static curriculum. The story catalog selects all
stories and chapters. Reader, PDF, and question services likewise query by id
without adding a `published` predicate. The schema carries draft/published
state, but the present runtime does not use it to hide draft records.

The overview screen is not currently an answer-event projection. It has
hard-coded progress figures while the event tables receive real attempts. Any
future progress feature needs an explicit aggregation policy for duplicate
attempts, replaced question identities, work-mode null correctness, and the
separate math/story question families rather than treating the current numbers
as database-derived.

# module-relationships

The app/domain-services module is the primary runtime consumer. Its database
client owns the server-only connection setup. Session functions consume
`sr_users` to authenticate an HMAC-signed cookie. Lesson functions consume
`sr_lessons` for metadata, HTML, PDF, and catalog availability. Math quiz
functions consume `sr_questions` and write `sr_answer_events`. Story functions
consume the story, chapter, and question rows, render stored Markdown, and write
the separate story answer-event rows. The learner-experience module is
downstream of those services: it never sees a connection string and receives
only the data each server function exposes.

The math-courseware module is an upstream writer for lessons and math decks. It
uses the database schema as the persistence contract after validating curriculum
and lesson artifacts. Its HTML save creates or updates a lesson; its deck save
replaces questions and generates the reader-visible practice section. The
database's uniqueness and cascade rules mean that a content writer must consider
both catalog identity and learner-history deletion when changing a deck. The
static curriculum is a separate companion contract: it supplies the labels and
order that turn a database lesson id into an accessible catalog item.

The biography-reading module is an upstream writer for public-domain story
content. Its saver enforces source-url, Markdown, question, and section-number
rules before it writes. The schema then holds the source URL on the parent,
chapter order and citation range on the child, and questions/events in a
dedicated family. The data shape allows the shared quiz UI to serve both content
types without confusing their question ids or relaxing math-specific typed
answer behavior.

The operational runbook is the deployment relationship. It applies this single
DDL file using the secret connection string and expects all content writers and
the app to target the same shared Azure PostgreSQL database/schema. Because
there is no independent migration runner, a schema change must coordinate the
DDL, every saver, app read/write functions, and any existing deployed database
shape. Updating one consumer alone can make a valid table unreadable or allow
content writers to create rows that another consumer does not understand.

# constraints

The schema file is the source of truth for table and column shape. Schema
changes belong here and must be applied through the server-only `psql` path;
application code, browser code, and content artifacts must not invent columns
or maintain parallel table definitions. All runtime reads and writes go through
the shared server-side SQL client, whose connection string must remain outside
the client bundle. Content save scripts use the same server-only database and
must remain the only writers for generated lesson and biography rows.

Foreign keys establish content lifetime. Deleting a learner removes math and
story answer events. Deleting a lesson removes its questions and therefore their
events. Deleting a story removes its chapters, their questions, and their
events. Deleting a single question also removes all attempts at that question.
This makes parent deletion straightforward, but it makes deck replacement a
destructive historical operation. Do not convert a deck update into a
delete/reinsert cycle casually when preserving attempts matters.

Answer-key secrecy is a schema-plus-service invariant. The key material has to
exist in `sr_questions` and `sr_story_questions` so the server can evaluate an
attempt, but it must not be selected into an initial browser payload or embedded
into a lesson's generated practice HTML. Correctness is not a client
calculation. Both math and story answer recorders must require a valid learner
identity before inserting an event and revealing feedback.

Several semantic invariants deliberately live above the database. The schema
does not prove that a choice has a valid option index, that input-only values
are null for other modes, that a story chapter's section range follows the
previous chapter, that a stage label and order are paired, or that a lesson id
matches its declared subject/stage/order. The current savers and server
functions enforce the relevant parts. Any new writing path has to preserve these
checks or strengthen the DDL explicitly; it cannot assume that a successful SQL
insert represents valid learner content.

# known-limits

The DDL is a creation script, not a migration system. It contains only
`CREATE ... IF NOT EXISTS` statements and no version table or `ALTER TABLE`
operations. Reapplying it creates a missing table or index but does not add a
missing new column to an already-created production table. Operational
instructions that advise reapplying the schema after a missing-column error are
therefore insufficient for an evolved database; a deliberate migration must be
added and applied.

Draft status is stored for lessons, stories, and chapters but does not currently
control public reads. Catalog, reader, PDF, and question functions query rows
without filtering to `published`, so every persisted draft is learner-visible.
The status column is presently metadata rather than an enforced publication
boundary.

Question replacement destroys answer history for the replaced question ids.
Both content savers delete their old question rows before inserting a new deck,
and the event-table foreign keys cascade those deletions. There is no revision
or mapping layer that preserves attempts across a revised question with the
same displayed order.

The database alone does not validate answer-mode companion fields, review
semantics, story section continuity, or curriculum identities. It depends on
the current savers and services to uphold these rules. Direct SQL writes can
produce internally inconsistent but constraint-valid rows. The current app also
has no stored session/revocation model and uses a development fallback session
secret when `SESSION_SECRET` is absent; deployment must provide a real secret.

The home-page progress panel is hard-coded rather than derived from answer
events. Work answers record an attempt but not the learner's reasoning text or
media, and the blob-id fields are placeholders. The existing schema supports
future progress and review work, but those product capabilities are not yet
implemented.

# notes-for-ai

Before changing this schema, map every affected table to its content writer and
runtime reader. A math-question change affects the math saver, deck validator,
quiz fetcher, server-side scorer, normalizer, practice-section renderer, and
answer-event consumers. A story-question change affects the story saver,
catalog/reader, story quiz fetcher, and separate event family. A parent-table
change can also alter delete cascades. Do not infer the impact from a column
name alone; trace the writer, browser-safe read, privileged answer read, and
event insert.

For any database evolution, write an explicit migration plan in the schema
source and verify it against an existing database shape. Re-running the present
creation statements will not evolve an old table. Preserve the quoted search
path, TLS server connection, and all existing foreign-key relationships unless
the product change deliberately changes data lifetime. When preserving learner
history is a requirement, design stable question versioning or a migration path
before changing the saver behavior that delete/reinserts decks.

Keep direct SQL out of generated content workflows. Use the current content
savers because they validate story provenance, chapter format and section
continuity, math ledger metadata, lesson/deck shape, and generated practice/PDF
coupling. If a new writer is unavoidable, give it equivalent validation and
answer-secrecy behavior before it touches production rows. Never send the
connection string, password hashes, hidden keys, accepted input forms, or
reference answers to the browser before the appropriate server operation.

Verify both database contracts and product behavior after a change. At minimum,
exercise a lesson and story read, PDF retrieval, catalog ordering, one choice
answer, one math typed answer, and one work answer while inspecting that initial
question reads omit keys. Test deletion or replacement behavior deliberately in
a disposable database when changing foreign keys or savers. For progress work,
define how retries, revised decks, null work correctness, and separate question
families aggregate before replacing the current mock display.
