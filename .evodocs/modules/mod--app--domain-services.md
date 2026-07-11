# purpose

The domain-services module is StemRobin's trusted application layer. It turns
the shared PostgreSQL schema into browser-safe learning data, determines which
outline items are available, establishes the learner identity used to record
attempts, and makes the answer decision that the browser is not allowed to make
for itself. It is the only part of the application that knows the database
connection, hidden correct indexes, accepted typed-answer forms, password hashes,
or signed session format.

The module supports two content families with one consistent runtime contract.
Math lessons are stored HTML documents with optional printable PDFs and structured
practice decks. Biography reading is stored Markdown grouped into stories and
ordered chapters, with its own printable PDFs and question tables. Each family
has a catalog read, a detail read, a question read, and an answer-recording
operation. The learner UI is intentionally insulated from the tables and receives
only data appropriate to the phase of interaction.

This is also the policy boundary for answer-key secrecy. The initial question
read supplies a prompt, cognitive type, answer mode, display order, and choice
options. It never supplies a correct option, an input acceptance set, or a
reference explanation. The corresponding POST operation checks the signed
learner session, loads the hidden values itself, records an attempt, and then
returns a verdict and explanation. That ordering is a product rule rather than a
presentation convention.

# structure

The database boundary begins with a memoized Postgres client. It accepts the
local authoring connection variable or the deployment variable, fails immediately
when neither exists, requires TLS, and sets a quoted search path for the
hyphenated project schema. The client limits concurrent connections and rotates
idle or long-lived sockets so a reused server process does not issue its next
query on a connection already closed by Azure. Every query in this module is
constructed through that client; a second client, browser connection, or
alternative schema selection would break the project-wide persistence contract.

The curriculum area maintains a fixed, ordered human outline for math and
physics. Titles live in that outline without ids. An id is instead calculated
from a supported subject, the stage position, and the lesson position. Given the
set of persisted lesson ids, the module derives a fresh linked outline and a
flat available-lesson list in outline order. It also derives previous and next
entries from exactly that filtered list. This means persisted content controls
availability and navigation, while the outline remains the source of labels,
ordering, and lesson positions. The empty robot subject intentionally produces
no outline id.

The lesson service reads lesson metadata, stored HTML, stored PDF bytes, and the
full lesson-id set. PDF bytes are encoded as base64 inside the server operation
so the browser can construct a download without database access. The story
service has a parallel shape, but its catalog comes entirely from story and
chapter rows. It preserves stored chapter order and stage metadata, joins a
chapter to its parent story for a reading title, converts trusted persisted
Markdown to HTML on the server, and retrieves chapter PDFs separately. The
content savers enforce the content formats before persistence; runtime code is
not a second content authoring or validation workflow.

Quiz operations form a small, deliberate public contract. Math and story question
readers both produce a visible question object containing id, order, cognitive
type, prompt, answer mode, and options. This lets the shared quiz drawer render
either family without knowing its table. Math questions can be choice, typed
input, or spoken work; story questions use choice or spoken work. The matching
answer result gives the UI a boolean or ungraded null, a correct index only for
choice, and a reference explanation only after submission.

Session code is physically server-only. It validates the stored `scrypt` hash
with a timing-safe comparison and signs only the numeric user id with an
HMAC-SHA256 secret. The cookie is httpOnly, same-site lax, rooted at `/`, and
lasts thirty days. A current-user read validates both the signature and the
continued presence of the user row. The module also exposes a very small Zustand
store for the responsive catalog drawer; it is intentionally the only transient
browser-state exception inside this otherwise server-oriented child.

# flows

Lesson discovery begins when a route asks for all lesson ids. The service selects
the ids present in `sr_lessons`, and the curriculum projection intersects them
with the fixed outline. The result keeps the original stage and lesson order,
adds ids only to entries that have persisted material, and keeps ungenerated
entries as plain labels. The same projection produces a flat sequence for footer
navigation. An unknown id has no predecessor or successor, so an outline-only
lesson never becomes navigable simply because its title appears in the catalog.
The tests lock down this no-mutation, deterministic-order behavior.

A lesson detail request fetches stored HTML by id. Missing rows and rows with
empty HTML return null, allowing the route to show a missing-courseware state
instead of looking for a local file. A PDF request takes the same id and returns
null when the row or bytes are absent. Story detail follows a different
projection: a chapter row joins to its parent story, its Markdown is converted to
HTML on the server, and the result includes both chapter and story titles. Story
catalog building first fetches all stories and all chapters, groups chapters by
their foreign key, and retains their database order and stored citation ranges.

An initial math quiz request selects only the visible fields from a question row.
For a choice question it includes the options but not the stored correct index.
For typed input it excludes the `accept` JSON array. For work items it excludes
the reference answer. The story question reader applies the same secrecy rule.
This fetch happens before a learner necessarily has a session, because reading
the practice prompts is not itself a durable event.

Recording a math answer starts by reading and verifying the signed cookie. A
missing or invalid user produces a login error and no event row. For choice, the
service requires a numeric original option index, compares it with the hidden
correct index, writes `chosen` and the boolean result to the lesson answer-event
table, and returns the answer plus the correct index. For typed input, it rejects
blank text, normalizes both sides, writes the trimmed text and the boolean
result, and returns no correct index. Normalization removes whitespace, maps
full-width characters and punctuation into ordinary forms, unifies several minus
glyphs, changes superscripts into caret notation, and treats explicit
multiplication before letters or parentheses as implicit while preserving numeric
products such as `2*3`.

Spoken work items are intentionally not auto-graded. The service writes an
attempt with null correctness and returns the hidden reference explanation after
the learner declares the response complete. Story recording uses the same
ungraded behavior for its work items; story choice compares against the separate
story-question index and writes to the separate story-event table. Keeping the
two event spaces separate preserves their foreign keys while keeping the UI
response shape identical.

Login lowercases and trims the supplied email, looks up the stored user record,
verifies the scrypt hash, and then sets the signed cookie. Logout expires that
cookie. The drawer store has no relationship to any of these operations: it
holds only an open/closed flag that survives client-side route transitions and
is reset by the surrounding responsive shell.

# module-relationships

The database-schema module defines the exact stored contracts this module reads
and writes. Lesson data depends on `sr_lessons`, `sr_questions`, and
`sr_answer_events`; story data depends on `sr_stories`, `sr_story_chapters`,
`sr_story_questions`, and `sr_story_answer_events`; identity depends on
`sr_users`. Foreign keys and uniqueness constraints determine which content and
attempt writes can succeed. The domain module does not invent parallel
structures, and the application must preserve the project schema search path on
every connection because all SQL assumes those unqualified table names resolve
inside `stemrobin-schema`.

The math courseware generator is an upstream writer. Its ledger and outline
checks ensure a deterministic math id, then its saver writes lesson HTML, PDF,
metadata, and deck rows. When the saver writes a deck, it also replaces the
stored questions and embeds a prompt-only practice section into the lesson HTML.
The biography generator similarly writes story provenance, chapter Markdown,
chapter staging and section ranges, PDFs, and question rows. This module
therefore consumes generated database state, never local lesson files. A saver
change to ids, columns, answer modes, or source format must be checked against
the runtime reads here.

The learner-experience module is the downstream consumer. SSR route loaders call
catalog and detail readers, lesson and story pages download the base64 PDFs, and
the shared quiz drawer calls visible-question readers and answer recorders. It
also consumes the curriculum projection to decide which links show and uses the
layout store to open the mobile catalog. It must not reconstruct visibility,
grade answers, render raw story Markdown, or query tables directly, because
those would bypass the policy implemented here.

The app parent supplies TanStack Start server-function transport and keeps the
session implementation in a `.server.ts` file so Node crypto and cookie APIs do
not enter the client bundle. The root document's KaTeX resources complement
question prompts and generated lesson HTML, but the domain module only moves
those strings and does not typeset them. This separation lets generated content
evolve without coupling database decisions to React rendering behavior.

# constraints

All database reads and writes are server-only and go through the shared `sql()`
client. The connection URL must never be serialized to the browser, and a missing
configuration variable is an immediate server error. Do not create a secondary
client for an individual feature or switch the search path per query. The schema
has a hyphenated name and the existing client configuration quotes it for a
reason. Connection recycling settings are also operationally important because
the shared Azure database can close old idle connections.

The answer-key boundary must remain intact for both content families. Question
readers must never select or serialize `correct_index`, `accept`, or `answer`.
Record operations must obtain those values from storage only after they have
verified the session. Choice submissions must use original database option
indexes, even when the UI has shuffled presentation. Typed input must normalize
the learner value and every candidate `accept` value through the same function;
otherwise ordinary Chinese keyboard variants would make equivalent answers fail.
Work answers have deliberately null correctness and must not be represented as
wrong answers.

The curriculum must keep its fixed outline free of hand-maintained availability
ids. Derivation functions return new objects, and tests assert the source outline
does not change. Story visibility and order are database authored, while lesson
visibility is the intersection of DB ids and the deterministic outline. Session
tokens carry only a user id and derive their validity from the HMAC and user-row
lookup; password hashes remain in the database and must never enter a server
function response.

# known-limits

Current content reads do not filter by `status`, so draft lesson rows, stories,
and chapters can appear wherever their ids or parent rows are selected. The
status fields exist in the schema but are not currently an access-control gate.

The module records granular attempts but does not calculate learner progress,
mastery, streaks, weak concepts, or a review schedule at runtime. The overview
therefore cannot obtain real progress from this module yet.

Authentication is intentionally minimal: there is no account creation, password
reset, role model, session revocation list, rotation protocol, or external
identity provider. The session secret has a development fallback, so deployment
security depends on injecting a unique `SESSION_SECRET`. Story Markdown is
trusted because the generation path rejects embedded HTML; arbitrary user-authored
Markdown is not a supported input.

# notes-for-ai

Before changing a service operation, identify the exact table columns and
foreign-key consequences in the schema, then inspect the relevant content saver
and its input contract. Changes to lesson questions often need coordinated
updates across the math deck validator, saver, question reader, answer recorder,
and quiz UI. A new story answer mode requires the same breadth across the story
saver, schema check constraint, question reader, recorder, and shared UI
contract. Do not add client-side grading as a shortcut.

For catalog and navigation changes, preserve the distinction between human
outline order and persisted availability. Add titles to the appropriate outline
and let a matching persisted row activate them; do not put availability flags in
the constant. Test first, middle, last, and absent ids, and verify every
projection leaves the source outline untouched. For story catalog changes, check
chapter ordering, stage ordering, section ranges, and the behavior for stories
with no staged chapters.

When modifying typed answer behavior, extend the normalizer and its unit tests
as one change. Retain the numeric-product exception and test the server-side
comparison using representative `accept` values. When modifying identity,
exercise malformed cookie tokens, missing users, timing-safe comparison paths,
case-normalized email lookup, and cookie expiry. Preserve server-only imports so
crypto and the database client remain absent from browser bundles.

Verify runtime work through the application rather than by reading query strings.
Run the unit suite for curriculum and normalization changes. For content,
authentication, quiz, or schema changes, run the app against a controlled
database and confirm initial network responses omit hidden answer fields, logged
out submissions write nothing, each answer mode writes the intended event shape,
and post-answer responses reveal only the expected data.
