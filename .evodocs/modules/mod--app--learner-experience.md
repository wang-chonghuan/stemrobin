# purpose

The learner-experience module is the browser-facing study workspace. It provides
the routed Chinese interface where a learner browses a curriculum, opens a lesson
or biography chapter, downloads printable material, signs in, and completes card
questions. Its responsibility is not to decide which data is valid or which
answer is correct. Instead, it converts the safe server-function contracts from
the domain-services module into a compact, responsive learning flow while
preserving the security and rendering assumptions behind those contracts.

The module unifies two different authored content formats. A math lesson is
stored as self-contained HTML with its generated practice section and is shown
inside a sandboxed iframe. A biography chapter begins as controlled Markdown,
has been transformed into trusted HTML on the server, and is shown as a reading
article. Both formats have a shared top bar, PDF download, mobile catalog access,
and card quiz. The shared behavior is intentional: a learner should move between
courseware and reading without encountering a different application model.

The visual tone is a dense, school-serious workspace: a white detail surface,
quiet teal-blue primary state, green correctness state, neutral ink text, and a
single left-side catalog. The implementation treats these as layout and
interaction contracts. A catalog that disappears incorrectly, an iframe that
overflows a phone viewport, a quiz that retypesets in the wrong phase, or a
button that reveals an answer early are functional regressions, not superficial
styling issues.

# structure

The root route supplies the document frame. It sets Chinese language metadata,
loads the global visual system, and adds KaTeX stylesheet, runtime, and
auto-render resources. The application router restores scroll positions and
uses a full-screen Chinese not-found view. The Start instance is presently an
empty configuration hook, leaving route modules as the authored application
entry surfaces rather than adding middleware behavior.

The main layout route forms the persistent workspace. Its loader receives live
lesson ids and story catalog entries. It renders a catalog beside an outlet, so
the catalog survives navigation between overview, lesson, story, and login
routes. A `matchMedia` listener treats widths below 1200px as drawer mode. In
that mode, the catalog becomes an off-canvas panel with a scrim and a local open
flag; on returning to desktop, the layout closes the flag because the rail is
always visible. The media query in CSS mirrors the same threshold, keeping the
state machine and geometry aligned.

The catalog is a structured navigator, not merely a list of links. It renders
the fixed math and physics outline from a derived copy that contains ids only for
persisted lessons. A subject count reports live entries over the total when any
exist, and a stage opens automatically when it contains a live lesson. Unready
entries remain text, preventing a learner from navigating to a course placeholder.
Biographies use their own database-authored story and chapter structure. When
chapters carry stage data, the catalog groups them by stage name and stored stage
order; otherwise it falls back to a flat chapter list. Saved global section
ranges appear beside links so a reader can locate a cited part of a chapter.

The route set has four learner surfaces. The overview lists live lesson cards,
educational pillars, and a current mock progress panel. The lesson route loads
stored HTML plus the available lesson sequence, gives the generated document the
full detail width, supplies a previous/next footer, and opens practice in the
drawer. The story route loads a chapter view and displays its server-rendered
HTML as reading prose with the same quiz and download affordances. The login
route contains only the minimal credential form and server-error feedback. Each
detail view includes a mobile catalog trigger because its persistent shell may
be off canvas.

The quiz drawer is a reusable interaction component with injected data sources.
It has no lesson-specific or story-specific query logic. On open, it resets
question position, local answers, typing state, pending controls, errors, and
choice permutations; it then fetches the current user and visible question set.
It renders choice, typed input, and spoken-work states with a common navigation
footer. Local state retains only the learner's selected original option index or
typed text so the UI can identify the wrong selection and preserve a submitted
typed answer after the server returns a verdict.

The CSS owns the visual implementation: global design tokens, the full-viewport
application frame, scrollable catalog and detail regions, outline disclosure
rows, reading typography, buttons, lesson footer navigation, focus treatment,
drawer and scrim stacking, reduced-motion behavior, quiz presentation, login
controls, lesson cards, and progress presentation. It is not a Tailwind utility
layer alone; routes and components depend on its stable semantic class names.

# flows

The usual learner flow starts at the shared layout loader. It receives the
available lesson ids and story catalog, renders navigation once, and places the
selected nested route in the detail pane. At desktop width the 236px catalog
remains visible. At a smaller width, a route's menu button sets the drawer flag,
the catalog slides in, and the scrim closes it. Clicking a ready lesson or story
link also closes the drawer in mobile mode. Because the catalog is not
unmounted while details change, disclosure state uses native `details` elements
and persists through ordinary route navigation.

The overview separately loads lesson ids and derives the live lesson cards. It
does not make unavailable curriculum entries visible as cards. The lesson page
uses the id from the route to request stored HTML and the complete live id list.
If HTML is missing, it shows the “not generated” state. When HTML is present,
the page assigns it to the iframe `srcDoc` and sizes the iframe by inspecting the
embedded body after load. It repeats measurement after two delayed intervals and
continues observing the body through `ResizeObserver`, which covers font and
practice-layout changes after the first load. The iframe retains
`allow-scripts`, `allow-same-origin`, and `allow-modals` sandbox permissions.

Lesson footer navigation is calculated from the database-filtered curriculum
sequence. A first or last live lesson keeps its disabled side visible to maintain
the layout. An unknown or unready lesson shows no footer. A PDF download requests
base64 content from the server, constructs a browser `Blob` URL, clicks a
temporary anchor, and revokes the URL. The story route follows the same download
flow. Its body is already server-rendered HTML from persisted Markdown, so it
uses the reading article and no iframe. Missing story content gets its own
dim-text absence state.

Opening practice invokes the shared drawer with a content id plus matching fetch
and record operations. A closed drawer renders nothing. On open, it checks
whether a user is logged in and reads visible questions. A logged-out learner
sees a login link; an empty set shows a no-questions message. For choice items,
the drawer creates one Fisher-Yates permutation of original option indexes and
uses it for the lifetime of that opening. It sends the original index when
clicked, immediately highlights the pending option, and after success marks both
the correct option and an incorrect pick. This preserves server grading even
when visual order changes.

For typed input, the drawer supports Enter and a submit control, disables the
field after a response, and applies correct or wrong styling from the server
result. For spoken-work prompts, it tells the learner to explain first and
submits a response with no selected option or text; its result has no graded
verdict and exposes the reference explanation. Network, cold-start, and
unexpected record failures leave the current question retryable and show a
Chinese error. Question content and choice options are typeset only when the
visible card changes. The answer explanation is typeset separately after it
appears, preventing a post-answer KaTeX pass from moving the option list to the
top of the drawer.

Login keeps email, password, busy state, and one server error in local state.
It prevents duplicate submits while busy, calls the login server operation, and
navigates home only after the server returns a user result. The UI neither
constructs a session token nor decides whether a password is valid.

# module-relationships

The domain-services module is the sole producer of dynamic learner data. The
shell consumes lesson ids and story catalog entries; overview, lesson, and story
loaders consume domain reads; login and quiz controls consume domain writes. The
direction of that relationship is important: this module must work with
browser-safe view models and post selected indexes or typed text, never with
database rows, secrets, or hidden answer fields. The shared quiz props make the
same component usable for lesson and story contracts while keeping those
contracts adjudicated on the server.

The content-generation module is an upstream producer of the rendered material.
Math persistence creates the lesson HTML and prompt-only practice which this
module shows in the iframe, as well as the PDF bytes the download action uses.
Biography persistence creates chapter Markdown, global section numbering, staged
catalog metadata, question records, and chapter PDFs; the domain module turns
that Markdown into the HTML passed to this module. Generated content controls
what the learner sees, so renderer changes must be tested with actual persisted
lessons and chapters rather than placeholder markup.

The app parent gives this child its SSR route tree and owns build/deployment
composition. The root document within this child relates to the KaTeX CDN, and
the quiz drawer invokes the loaded auto-render function for question and answer
nodes. The CSS token layer is the source of truth for actual implemented layout
and color values. The separate design reference records the intended visual
identity and tells future UI work to reconcile rules against the implemented
tokens.

Browser tests sit beside the app as a verification surface. They assert that
generated practice appears with the expected shape in the iframe, that iframe
HTML does not contain answer-key fields, and that both page and embedded document
fit a 390px viewport. Those checks protect the boundary between generator,
server delivery, and learner experience.

# constraints

The catalog must remain persistent around the detail outlet and must preserve
the semantic difference between a ready link and an outline-only item. Do not
put a separate availability cache in this module. Use the derived ids returned
by the domain child, preserve the current stage grouping rules for stories, and
close the catalog through the shell callback after mobile navigation. Desktop and
mobile geometry are linked: the JavaScript media listener and CSS use the 1200px
drawer threshold, while the visual design values for catalog width, layout height,
colors, and control dimensions come from the `--sr-*` variables.

Lesson HTML must remain in a sandboxed iframe because it is self-contained
courseware with its own content markup. Retain the height lifecycle and test
long generated material, because a one-time height measurement does not capture
late font, KaTeX, or practice layout. Story HTML must continue to come only from
the trusted server-rendered chapter path. The client must not parse arbitrary
Markdown or accept user-supplied HTML.

Quiz presentation may shuffle choice positions, but it must retain and submit
the original indexes. It must not expose a correct index, `accept` strings, or
reference answer before the record operation returns. Keep its three visual
modes distinct: choice and typed input are graded; spoken work is a self-check
with a null verdict. Preserve independent KaTeX rendering targets and retryable
error behavior. Focus rings and reduced-motion overrides are part of the
interactive accessibility contract.

# known-limits

The overview progress card is static placeholder data rather than a learner
progress projection. It can look current even when answer-event data changes.

Initial user and question requests in the drawer have no explicit loading or
rejection UI. A failed initial fetch can leave the component looking like it has
no current question. Record requests handle retryable failures, but the opening
fetches do not.

The visual design reference still names an 860px mobile breakpoint, whereas the
implemented persistent-catalog-to-drawer behavior uses 1200px and the quiz drawer
has an 860px sizing adjustment. Any responsive rule change must resolve that
difference deliberately. Current detail routes show simple absent-content text
rather than a dedicated route-level missing-content view.

# notes-for-ai

Treat route, component, CSS, and server contract work as one learner flow. Before
changing a page, inspect its loader result, the matching domain operation, and
the catalog or quiz behavior that reaches it. When adding a content family,
either conform it to the injected quiz shape or give it a separately designed
interaction boundary; do not add database-specific conditionals throughout the
drawer. Keep the shared shell as the only owner of mobile catalog state.

For lesson rendering changes, test a real stored courseware document with
long-form content, KaTeX, and generated practice. Check iframe sizing after
load, after delayed layout, and at a narrow mobile viewport. Confirm the sandbox
remains present, footer navigation respects only live lesson ids, and the PDF
action revokes the generated object URL. For reading changes, verify staged and
unstaged story catalogs, global section labels, missing views, PDF download, and
the typography of server-rendered paragraphs and headings.

For quiz work, test logged-out, empty, choice, input, and work paths. Verify that
a randomized option display still sends the original index; then test a wrong
choice, correct choice, blank typed input, alternate keyboard forms handled by
the server, a spoken response, navigation between cards, close/reopen reset, and
network retry. Inspect browser-visible question data before answering to confirm
it lacks correct indexes, accepted forms, and explanations. Check KaTeX in a
question and in a reveal separately.

Run the existing browser regression against a real server after changes to
lesson, iframe, practice, or mobile layout. Add a route-level browser test when
a regression would not be captured by pure unit tests. Preserve the token-led
compact workspace, existing visible focus treatment, and reduced-motion
fallback. Do not edit generated router output; route behavior lives in authored
route modules.
