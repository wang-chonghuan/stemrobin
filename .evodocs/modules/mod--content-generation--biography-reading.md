# purpose

The biography-reading module produces StemRobin's Chinese creator biographies:
public-domain source books become ordered, readable narrative chapters with
detail-sensitive quiz questions and printable PDFs. Its purpose is not to teach
through a conventional lesson template. It gives a reader aged roughly twelve to
sixteen a factual story about how a creator, inventor, or industrialist moved
from circumstances and decisions into science, invention, or enterprise, while
keeping ethical judgment and reflective discussion in the question set rather
than turning the narrative into a sermon.

The module makes provenance and narrative quality durable product requirements.
Every fact, name, date, and number needs a traceable public-domain source. Every
chapter is written in Chinese in the author's own words, with no quotations,
blockquotes, or copied excerpts. A saved story row retains the source URL; a
chapter row retains the Markdown body, its place in the story, optional named
stage, globally unique section range, status, and printable PDF. The application
then renders that Markdown and gives a learner a catalog, reader, download, and
card-quiz experience.

The gate sequence is essential. A producer adapts source material into an
outline, chapter prose, and questions. An independent reviewer asks whether the
chapter reads as a story a young reader would finish, whether its facts are
traceable, and whether its format avoids lists, quotes, preaching, and padding.
Only then does a deterministic saver write the story, chapter, questions, and
PDF. A long Markdown document without that source and gate discipline is not a
valid biography artifact.

# structure

The input boundary is a public-domain book from Project Gutenberg or an eligible
Internet Archive source. The author records its exact source URL because it is
stored with the story and becomes the provenance anchor for every chapter. The
conversion helper accepts a local book file, requires `markitdown` to be
installed, and writes normalized Markdown to an authoring scratch location. It
does not edit the source into a story. A missing converter, absent input, or
suspiciously short conversion is a hard failure, preserving a visible gap
instead of inventing source material.

The outline stage turns a raw book into an adapted arc of roughly six to twelve
chapters. It is not a copy of the source table of contents. Every planned chapter
has one carryable focus, an arc connecting invention or business to human
judgment, and a source span that tells the chapter author which source slice
contains its real events. The outline should cover origins, important moves,
enterprise building, and later consequences, including ethical complexity rather
than stopping at a triumphant midpoint.

A chapter is persisted as Markdown, not HTML. It starts with one H1 title and
contains a handful of numbered H2 sections. Each H2 has a global section number
and a short scene or turning-point title; continuous narrative paragraphs follow
it. The global numbers do not reset for later chapters. This allows a reader to
cite a single section number anywhere in one biography and allows the catalog to
display a chapter's start and end range. The narrative uses concrete scenes,
dates, numbers, people, causes, and decisions in chronological order. It may
bold a small number of important terms or facts, but it must not use blockquotes,
lists, HTML, or reader-reveal elements.

The questions are a separate structured artifact, normally eight to fourteen
items per chapter. Most are three- or four-option choices about concrete
narrative details and plausible chapter-specific misreadings. At least two are
open work responses that ask the reader to assess character, inference, or
business judgment. This split is intentional: the prose reports events without
preaching; the questions provide the product's space for ethical reasoning and
debate. Every question has a hidden reference answer, but only choices have
stored options and a correct index.

The deterministic save path owns mechanical persistence. It validates the story
slug, chapter identifier, status, Markdown shape, Chinese-character length,
numbered section sequence, question shape, and open-question count. It renders
the Markdown through `marked` into a printable HTML document and asks
Playwright-core for a PDF. It then upserts the parent story, upserts the chapter,
deletes prior questions for that chapter, and inserts the replacement sequence.
The database cascades those question deletions to their learner answer events,
so a question-deck revision also discards history attached to the prior question
ids. All writes use the project PostgreSQL schema and a root environment
connection string. Re-running the command for the same identifiers is an
intentional overwrite, not an additional revision row.

# flows

Biography production starts by confirming that the intended source is outside
US copyright and recording its source URL. The conversion helper then turns an
input book into working Markdown using `markitdown`. The result is source
material only; it is not committed product content and should not be manually
rewritten to look like a chapter. The author examines the book in slices, finds
the real narrative arc, and writes an outline that maps chapter focuses to source
spans. This allows a later chapter author to mine enough real detail rather than
inventing facts or stretching a thin summary to meet a length target.

For one chapter, an independent producer receives the relevant outline entry and
source slice. The producer writes a Chinese H1 and numbered H2 sections whose
prose moves through events in time order. The shared contract requires at least
two numbered sections and expects several; their numbers must continue from the
last saved chapter in the same story. A deterministic word-count tool counts
Chinese characters and rejects prose under 2000 characters. The correct repair
for a short chapter is additional source-grounded scenes, figures, people, and
causal detail, not more reflection or generic encouragement.

The independent gate then reviews the chapter against its source slice. It
rejects unexplained factual inventions, copyright uncertainty, quotation or
block quotation, list-shaped exposition, a lecture-like structure, moralizing,
missing hook, or padded writing. The gate has a different role from the
word-count script: the script can prove the length and basic shape, while the
gate decides whether the piece tells a factual story a reader would follow.

Question authoring happens after the chapter exists. The question producer creates
a JSON array that covers comprehension, inference, entrepreneurial reasoning,
character, and error recognition. Choice questions test exact events and causal
details with credible misreadings. Work questions have no automatically correct
option and ask the learner to state and weigh a reasoned judgment that prose
intentionally leaves open. Their hidden answers guide self-check after a learner
has responded rather than giving the answer in the reader.

Saving runs the mechanical checks before any database mutation. Markdown must
contain an H1, cannot contain HTML tags, `>` blocks, ordinary list lines, or
unfilled placeholders, and must contain continuous numbered H2 sections. The
saver calculates the chapter's first and last section number, queries earlier
chapters for the same story, and fails unless the first number is exactly one
greater than the prior maximum. It also requires choices to have valid option
indexes and every question to have an answer, with at least two work questions.

After the checks, persistence upserts the story's title, person, era, source
URL, and status, then upserts the chapter's Markdown, ordering, stage metadata,
section range, PDF, and status. It replaces the associated question rows in one
operation, which removes the old question ids and their cascading answer-event
history. The app's catalog obtains story and chapter records, sorts chapters by
stored order, groups staged chapters, and displays the saved global section
ranges. The reader asks the server to render the chapter Markdown to HTML, while
the quiz fetch sends only prompts/options/modes before a response. The
post-answer operation records attempts and only then returns explanation or
choice correctness.

# module-relationships

The content-generation parent provides the shared producer, independent gate,
and deterministic saver discipline. This child specializes that discipline for
public-domain narrative and must not borrow the math child's ledger or exercise
rules. The math child and biography child share PostgreSQL persistence, draft
defaults, standalone skill dependencies, Playwright PDF rendering, and
answer-key secrecy, but biography has its own story/chapter/question tables and
never uses typed input mode.

The database-schema module owns the stable data contracts. `sr_stories` holds
identity and public-domain provenance. `sr_story_chapters` holds Markdown,
chapter order, optional stage label/order, globally continuous section range,
PDF, and status. `sr_story_questions` holds choice or work content, and
`sr_story_answer_events` records learner attempts in its own foreign-key space.
Changing any column or check constraint requires coordinated changes in the
saver, application readers, and answer recorder.

The domain-services module is the downstream reader and policy boundary. It
lists stories and chapters, renders saved Markdown with `marked`, returns
browser-safe questions, and records server-side answer results. The
learner-experience module consumes those views: the catalog groups stages and
shows `§` ranges, the story route renders the trusted HTML article, and the
shared quiz drawer handles choice and work prompts. This writer never needs to
create HTML for the app reader; producing Markdown is the deliberate contract.

The public-domain source is a permanent upstream relationship rather than a
citation afterthought. Its URL is saved beside the story, and every chapter fact
must remain traceable to its source span. A later content edit must retain that
chain even if the app's reading style or catalog layout changes.

# constraints

Use only public-domain source books and store their exact source URL. Do not
substitute a modern biography, quote from the source, or invent facts to make a
scene stronger. A narrative chapter is Chinese Markdown with one H1 and numbered
H2 sections, continuous prose, no HTML, no lists, no blockquotes, and no
learner-visible answer material. Save chapters in order because the section
counter is global per story and the saver checks earlier persisted rows.

Persist only through the saver after the independent narrative gate passes.
Do not hand-write story, chapter, question, or answer-event rows. Keep open
question answers as hidden reference material and preserve their null
correctness at runtime. New content defaults to draft, though current app reads
do not filter status; treat that as a publishing-control limitation rather than
a security barrier.

The saver needs the root database environment variable and the skill dependency
tree. PDF generation is best effort, but its failure must be reported while the
chapter and questions retain their validated database form. Re-saving a chapter
replaces its question set and cascades deletion of answer events tied to the old
question ids, so a revised JSON file must contain the entire desired chapter
deck, not only changed rows.

# known-limits

The chapter authoring capability document says a chapter has no headings beyond
the H1, but the shared story contract and saver require globally numbered H2
sections, and the current app catalog depends on their persisted ranges. Follow
the shared contract and saver until the conflicting authoring document is
corrected.

The word-count helper counts Chinese characters but cannot establish factual
accuracy, narrative quality, or copyright status. Those remain gate work.

The saver renders PDFs best effort and may persist a chapter without fresh PDF
bytes. The application also currently exposes draft stories and chapters because
its reads do not filter by status. Replacing a chapter deck deletes the answer
events for its prior question ids, so there is no history-preserving question
revision model or reader-progress model beyond the currently surviving
individual answer events.

# notes-for-ai

Start every new story with the provenance question, not the outline. Verify the
source's public-domain status, keep the exact URL, convert it without editing,
and preserve source spans in the outline so each later chapter can be fact
checked. Use a separate author and gate for outline, chapter, and questions as
the skill requires. Do not write a chapter directly from general knowledge or a
modern secondary source.

Before saving a chapter, run the word count and inspect the exact Markdown
structure. Verify the H1, globally continuous numbered H2 sections, absence of
quotes and lists, target source details, at least 2000 Chinese characters, and a
question deck with concrete choices plus at least two open reflective prompts.
For chapters after the first, query or inspect the previous saved section end;
do not guess the next number. Persisting out of order will fail by design.

After persistence, verify the product path: confirm the story appears in the
catalog, staged chapters group in the intended order, `§` ranges match the
saved headings, the reader renders prose as expected, and the PDF download is
available when Playwright produced one. Exercise one choice and one work
question through the app, confirming the initial fetch hides answer material and
the post-answer response records the correct event shape.

When changing this module's instruction files or saver, resolve the current H2
contradiction instead of spreading it. Treat the shared contract, saver, schema,
and runtime catalog as the current product behavior. Update any related gate and
capability instructions together so an author cannot receive a workflow that
passes one document but fails persistence.
