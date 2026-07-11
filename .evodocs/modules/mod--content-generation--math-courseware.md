# purpose

The math-courseware module is StemRobin's controlled production system for
database-backed math lessons. It turns a human-approved course sequence into
learner-facing Chinese courseware for a child who can handle secondary-school
mathematics but still needs concepts named, parsed, recalled, and explained
explicitly. Its purpose is not simply to generate attractive HTML or a bank of
questions. It prevents a specific pedagogical failure: a learner can imitate a
procedure yet cannot identify the mathematical objects involved, state why a
step is legal, distinguish a boundary case, or retrieve the idea after the
current lesson is over.

The module therefore treats curriculum structure as product behavior. A stage
has one load-bearing mental model, such as reading an algebraic expression as a
two-layer tree. A lesson owns a single installable idea and declares every
technical word it introduces or consumes. A question deck forces recall instead
of recognition where possible, makes edge cases testable, and carries review
items for earlier vocabulary. The generated artifact is not complete until it
has passed an independent pedagogical review and has been saved through the
deterministic persistence path that creates the HTML, printable PDF, card-quiz
questions, and application-visible lesson identity.

This division matters for future changes. Altering a title, adding a new
mathematical term, changing a lesson genre, or revising a question deck can
change prerequisite closure, the allowed vocabulary of later lessons, the
review schedule, catalog navigation, print output, and the answer-evaluation
contract. The module exists to make those consequences explicit before content
reaches a learner.

# structure

The upstream curriculum contract starts with the human math course guide. It
sets each stage's theme, intended lesson order, titles, and instructional
direction. It is deliberately not the full machine contract: it does not
describe every prerequisite term, edge instance, or review target. A
stage-level concept ledger expands the guide into that operational information.
Each ledger has a subject, stage, theme, one-sentence central model, declared
assumptions, and an ordered set of lessons. Each lesson has a deterministic id,
title, genre, status, core idea, introduced terms, consumed terms, and boundary
cases.

The ledger provides two forms of curriculum safety. First, it makes vocabulary
ownership unique: one lesson teaches a formal term, while later lessons may
consume it. Second, it makes gaps visible. A term from an earlier stage can be
listed as assumed; a needed idea that no earlier lesson actually teaches must be
recorded as a `GAP` with an explanatory note rather than silently treated as
known. The closure checker rejects a lesson that consumes a term it cannot yet
speak. This keeps a later method lesson from relying on a mathematical noun that
the learner has never been taught.

The lesson artifact is self-contained HTML because it is displayed inside an
application iframe and used as the source of a printable PDF. It carries its
own KaTeX setup, visual tokens, typography, print rules, and inline-SVG
conventions. Lesson genres are structural rather than cosmetic. A concept lesson
uses motivation, model, anatomy, boundary, connections, and oral sections to
teach and repeatedly parse a new category. A method lesson uses motivation,
explain, examples, connections, and oral sections to derive a move from a
principle, work it on examples, and require an explanation. A practice lesson
contains only a short orientation because its deck is the learning surface; it
does not introduce new content.

The deck is a second structured artifact, not a trailing worksheet written
inside the HTML. It has 16 to 24 items with a cognitive type and a role in the
lesson's exercise composition. The roles are recognition, operation, error
diagnosis, explanation, and review. Question modes distinguish typed short
answers, discriminating multiple choice, and open reasoning. The answer
explanation, multiple-choice key, and typed acceptable forms are persisted
server-side. They are intentionally separate from the rendered lesson and from
the initial client question payload.

The saver joins these artifacts into a persisted lesson. Its HTML operation
validates metadata and structural anchors, renders a PDF when the local
Playwright environment permits it, and upserts the lesson row. Its deck
operation validates composition, deletes and recreates the question rows, and
injects a fresh practice section into the stored lesson HTML. The deletion
cascades to learner answer events for the prior question ids, so a deck
replacement is also a destructive history operation. That generated section
shows each prompt and, for choices, its options, but it never embeds answer
keys or accepted typed forms. Saving the deck after the HTML is not a
convenience: it is the operation that makes the visible reading practice and
the final printable PDF match the actual saved deck.

# flows

Math production begins with the stage rather than an isolated lesson prompt. An
author starts from the human course guide and produces or revises the stage
ledger. The ledger must retain the guide's covered lessons in order while being
allowed to insert prerequisite anatomy lessons where they are needed. It
declares the stage model, such as an expression's addition and multiplication
layers, then assigns each formal term to its first teaching lesson. The
deterministic outline checker verifies theme and title/order fidelity; the
ledger checker verifies schema, stable ids, increasing order, unique term
ownership, assumption shape, and prerequisite closure. A separate gate then
tests the harder claim: that the planned lessons can actually be taught without
smuggling in undefined words or hiding two independent ideas in one lesson.

For a lesson, an independent author receives the current ledger entry and the
earlier entries that make its available language explicit. The author creates
the HTML using the appropriate genre structure. A concept lesson must show
positive and negative instances, a diagram, several parse-through examples,
and the declared boundary cases. A method lesson must make the governing
principle visible before it asks the learner to follow a procedure. Both kinds
of lesson connect backward to what is already known and forward to the
vocabulary or method that will depend on it. Oral prompts are part of the
artifact because the learner needs to name parts and state reasons, not only
read a definition.

An independent gate checks that the lesson lives within its vocabulary budget,
actually teaches introduced terms through instances, handles every promised
boundary case, follows the required anchors, and has not written a manual
practice section. Mechanical checks then catch missing anchors, remaining
placeholders, missing KaTeX or visual tokens, and references to later formal
terms. If authoring needs an unlisted term, the correct repair is to revise the
ledger and re-establish closure, not to insert a casual definition into a
lesson that does not own it.

Deck production follows the lesson because its questions must test the model,
examples, terms, and traps actually taught. The deck intentionally favors
`input` for short mathematical answers so the learner retrieves an answer
rather than recognizing it among options. Multiple choice is reserved mainly
for diagnostic discrimination, such as identifying an incorrect step or a
misread expression. Open `work` questions make the learner reconstruct a
reason, and their stored explanation models a strong answer after the attempt.
Every non-first lesson includes at least three review items that name earlier
ledger terms. This is the module's built-in spaced-review mechanism; it does
not depend on a separate runtime scheduler.

The exercise checker enforces the item count, contiguous order, permitted
types and layers, minimum identification and operation shares, at least two
error-diagnosis and two reasoning items, recall share, valid choice and input
shape, and valid review targets. Before saving, the deck author solves every
input and choice item, checks each answer key or accepted form, and confirms
that feedback teaches why. A separate semantic deck audit is not part of normal
generation; it is reserved for an explicit request, an answer-quality incident,
or an unusual answer format that the deterministic contract cannot validate.

Persistence is deliberately two-step. The HTML save first checks the lesson
against the ledger and human outline, stores its self-contained HTML and an
available PDF, and keeps the initial status as draft unless explicitly
promoted. The deck save again checks the ledger, requires the lesson to exist,
deletes all old questions and their cascading answer events, inserts the
supplied complete deck, removes any old injected practice area, produces a new
one from the entire deck, and re-renders the PDF. Re-saving an HTML lesson after
the deck has been saved removes that generated practice, so the deck must be
saved again. For a multi-lesson request, the browser checks run once after the
final save rather than once per lesson or deck. The entire process writes
through the server-only PostgreSQL connection; a direct row edit would leave
lesson, practice, PDF, deck, and learner-history state out of sync.

At runtime, the application treats the database as the lesson source. It
delivers stored HTML into a sandboxed iframe, serves the saved PDF for download,
and derives catalog availability from lesson ids that exist in the database.
The static curriculum outline still supplies labels, ordering, and navigation.
The card quiz initially receives only prompt, type, answer mode, and choices.
When a logged-in learner answers, the server evaluates choice and typed answers,
normalizes typed mathematical notation, records an answer event, and only then
returns the answer explanation. Work responses are recorded as ungraded events
and reveal their reference explanation after the learner says they have
responded.

# module-relationships

The content-generation parent supplies the shared producer, independent-review,
and deterministic-saver discipline used for generated learning material. This
child owns the math-specific part of that discipline: concept ledgers,
model-first teaching, vocabulary closure, boundary-case commitments,
recall-heavy decks, and scheduled review items. It should not inherit the
biography child's Markdown narrative or public-domain-source requirements.
Conversely, the biography module does not use a math ledger, typed answer mode,
or deck-injected practice section.

The human course guide is the primary upstream relationship. Its stage titles,
lesson order, and instructional direction are the intended human contract; the
ledger is the downstream operational contract that adds terms and dependencies.
The saver consumes both before it contacts the database. That means a title or
theme change cannot be treated as an isolated text change: it has to be
coordinated across the guide, the ledger, and the static curriculum outline
that labels the app's catalog. The existing application does not calculate
labels from the ledger, so a mismatch can be learner-visible even before a save
attempt exposes it.

The database-schema module owns the persistent contracts. `sr_lessons` holds
the lesson identity, subject/stage/order metadata, core concept, self-contained
HTML, optional PDF bytes, and draft or published status. `sr_questions` holds
the deck's ordered prompt, mode, options, hidden key material, layer, review
target, and explanation. `sr_answer_events` records a learner's option, typed
answer, or ungraded work attempt. Replacing a deck deletes all existing question
rows for the lesson before inserting the supplied full deck; their foreign keys
cascade that deletion to the associated answer events. It is therefore a whole
deck replacement rather than a patch-by-question operation, and it does not
preserve learner history for the replaced ids.

The application domain services read these tables but do not regenerate
courseware. Lesson services retrieve HTML, PDFs, and available ids. Quiz
services deliberately omit `correct_index`, `accept`, and `answer` from the
browser's initial question fetch; they query and evaluate those values only on
the server after a response. Typed answers pass through a shared normalizer that
folds whitespace, full-width characters, minus variants, common multiplication
marks, superscripts, brackets, and selected explicit-multiplication forms. The
client lesson route is consequently a consumer of persisted artifacts: it
frames the HTML, opens the quiz drawer, downloads the existing PDF, and uses the
database-filtered curriculum for previous and next navigation.

The static curriculum is a second downstream relationship with a distinct
ownership boundary. It defines every catalog slot and its label; database
presence activates the deterministic id for a slot without hand-editing
availability flags. Generated courseware must therefore use the exact
stage/order id that corresponds to a real outline entry. Adding a row with an
unknown id will not create coherent catalog navigation, while changing the
outline without coordinating saved content can redirect labels or ordering.

# constraints

The module has a strict source-of-truth chain. The human guide owns curriculum
intent and broad lesson sequence. A checked stage ledger owns machine-readable
math metadata: the central model, terms, closure, genres, edge cases, and
review targets. The persisted deck owns the learner-visible practice section,
not the hand-authored HTML. The database owns delivered lesson and question
content. The application only activates catalog availability from existing
deterministic lesson ids. Do not create parallel descriptions of vocabulary,
practice, availability, or question keys.

Every future content change must retain prerequisite closure. A lesson may
consume only an earlier introduced or explicitly assumed term; a term cannot be
introduced twice; a genuine missing prerequisite must remain visible as a
`GAP`. Concept lessons need at least two meaningful edge instances, and deck
items must actually test those cases rather than merely name them. A lesson
cannot use a later term because the child may recognize a familiar phrase while
missing the underlying category. The module's target learner is not protected by
simplifying vocabulary away; the protection is teaching vocabulary before it is
needed.

Persistence is permitted only through the saver with the relevant ledger. It
checks the guide/ledger relation before either lesson or deck operations, checks
HTML metadata and anchors, validates the deck before database mutation, and
renders or retains a PDF as available. Save the lesson HTML before its deck, and
submit the full desired deck because the operation replaces all question rows.
Do not hand-write `sr_lessons`, `sr_questions`, or answer rows, and do not
manually toggle catalog availability in the client outline.

Answer-key secrecy is a hard interface constraint. The HTML practice projection
can show prompts and choice options, but never explanations, choice keys, or
typed accept forms. Initial question fetchers must continue to omit those
fields. Correctness and typed normalization are server-side operations that
require a logged-in user before an answer event is written. Any change to deck
serialization, practice rendering, or quiz API must be reviewed against that
boundary.

# known-limits

The current stage-2 ledger is internally valid for prerequisite closure but
does not pass the human-outline checker. Its theme differs from the guide's
second-stage theme, and several guide lessons have been renamed or combined.
Because the saver always runs the outline check before either HTML or deck
persistence, a new or refreshed stage-2 lesson will be rejected until the
human guide, ledger, and catalog are deliberately reconciled. This is a content
contract conflict, not a reason to bypass the saver or insert database rows
manually.

Draft status is not currently a reader-access filter. Lesson services retrieve
rows and the catalog activates ids without filtering for `published`, so draft
content is visible whenever it is persisted. Status is useful metadata and a
publishing intention, but it is not an application-level release gate today.

PDF rendering is best effort. The saver preserves an existing PDF when a later
render attempt cannot produce a new one, and a first successful lesson save can
therefore leave the PDF empty while its HTML exists. Deck replacement is also
destructive by design: it removes the prior question rows and their dependent
answer events, so there is no courseware revision history, per-question update
path, or retained learner history for a replaced deck in the current persistence
model.

Open reasoning responses are not stored as learner text or media in the current
quiz experience. The system records an ungraded attempt and shows the reference
answer; the schema's blob field is a future-facing placeholder. This supports
self-check but does not yet provide a teacher-review record of the learner's
reasoning.

# notes-for-ai

When working on a stage, start by checking the human guide and ledger together,
then run the outline and ledger validators before authoring a lesson. Treat a
validator failure as evidence of a contract mismatch. Fix it at the correct
ownership boundary, with a human decision when it changes curriculum intent.
For stage 2 in particular, do not attempt persistence until the existing
guide-versus-ledger discrepancy has been resolved. After any intended change to
lesson titles or order, inspect the static curriculum outline as well because it
supplies learner-visible labels and navigation independently of the ledger.

For a content change, reason from the model and vocabulary rather than from a
single desired example. Read the lesson's ledger entry and every preceding entry
it consumes. Preserve unique term ownership, make edge cases concrete, and
ensure a method explains the principle that licenses it. Do not insert
mathematical jargon simply because it makes a paragraph shorter. If a needed
term is not available, revise the ledger first and repeat the closure review.

For exercises, validate the actual learning mechanism rather than only the
deck counts. Solve each item, test every `accept` string against the normalizer,
check that choices distinguish named misconceptions, and make review items
exercise the earlier `review_of` term rather than a restatement of the current
lesson. Keep short-form answers in input mode when their forms can be enumerated
fairly; move genuinely open or many-form answers to work or an appropriately
diagnostic choice. Preserve at least two substantive reasoning items and teach
through the hidden feedback answers.

For persistence and runtime verification, save the HTML before the deck and
re-save the deck after any HTML replacement. Confirm that the stored reader
contains the deck-generated practice without answer material, that PDF download
has the expected final state, and that the catalog exposes the intended
deterministic id in the intended position. Exercise a choice, typed input, and
work question through the application: initial network data must not contain
hidden keys, the server must normalize and score typed answers, and the result
must write an answer event only after login. Validate the normal unit and build
surfaces after any app-facing contract change.
