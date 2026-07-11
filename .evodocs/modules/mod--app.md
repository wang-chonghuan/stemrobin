# purpose

The application module is StemRobin's deployable learning product: a single
server-rendered web application that turns persisted math courseware and
biography chapters into an always-navigable learner workspace. It is responsible
for assembling the framework runtime, the document shell, the shared navigation
surface, the learner routes, the visual system, and the production artifact. It
does not author educational content or define database tables. Instead, it
consumes the content and persistence contracts owned elsewhere and gives them a
consistent interactive presentation.

The module's central value is that the same product surface supports two
different kinds of study material without creating two apps: lessons are
self-contained HTML shown in a sandboxed iframe, while biography chapters are
Markdown rendered on the server into reading prose. Both formats sit inside the
same catalog shell and attach the same answer-key-safe card quiz. A change here
therefore affects not only React rendering but also SSR loading, the separation
between browser and server data, the database-backed availability model, and the
container artifact that actually runs in production.

# structure

The runtime is a standalone TanStack Start application. The route bootstrap
creates an SSR router from the generated file-route tree, and the root document
sets the Chinese document metadata, global CSS, site icons, and KaTeX resources.
The generated route tree is derived from route files and should be regenerated
rather than edited directly. Vite combines the Start, React, Tailwind, and Nitro
plugins; Nitro emits the server output that the runtime process starts. The
application reads build-time environment configuration from the repository root,
while its own dependency manifest, lockfile, and installed dependencies remain
inside the application directory.

The application shell is a parent route that loads the current lesson ids and
biography catalog before rendering the catalog alongside an outlet. This makes
the catalog a persistent part of the application lifetime: navigating from the
overview to a lesson or story changes only the detail outlet rather than
recreating navigation state. On wide screens the catalog is a fixed left rail.
Below the shell's mobile breakpoint it becomes a drawer with a scrim, controlled
by a small in-memory layout store. The store deliberately owns only whether the
drawer is open; content, learner identity, answers, and all durable state remain
server-owned.

The two children divide the internal work. The domain-services child owns the
server functions, curriculum mapping, content lookup, database client, session
cookie handling, answer normalization, answer evaluation, and answer-event
recording. The learner-experience child owns routes, catalog presentation, quiz
interaction, iframe sizing, responsive behavior, and CSS. This parent owns the
composition between them plus the supporting build configuration, generated
router boundary, public assets, test entry points, and root document. It should
remain an integration layer rather than accumulating domain policies that belong
to the server-side child.

The CSS is a real application surface rather than incidental decoration. It
defines the compact white workspace, teal-blue and green state colors, a
fixed-width desktop catalog, scroll ownership for the detail pane, reader
typography, quiz feedback states, and mobile drawer geometry. The design relies
on stable class names shared by routes and components, so visual changes should
be reasoned about as changes to layout contracts and not merely isolated style
edits.

# flows

An ordinary request enters the SSR router and selects the root document, shared
application shell, and one nested route. The shell loader obtains the lesson ids
that exist in persistence and the ordered story/chapter catalog. The catalog
then combines the lesson ids with the fixed curriculum outline: every outline
entry has a deterministic id, but only ids found in persisted lesson rows become
links. Story chapters are different because their catalog is fully database
authored; the shell groups chapter links by their stored stage metadata when
present. This allows authoring tools to activate learning material through
persistence rather than through a UI deployment.

The overview repeats the lesson-id lookup and derives the current set of live
lessons. The lesson route fetches one stored HTML document and the same available
id set. When content exists, it supplies the HTML to an iframe through `srcDoc`;
the iframe is sandboxed and its height is measured on load, after delayed
resource layout, and through a `ResizeObserver`. The page uses the
database-filtered curriculum order to display predecessor and successor
navigation. A missing row produces a clear “not generated” state rather than a
local file fallback. A separate server call retrieves pre-rendered PDF bytes,
which the browser converts into a temporary download URL.

The story route follows the same top-level pattern but asks the server for a
chapter view. The database body is Markdown, and the server converts it to HTML
before the route places it in the reading article. The associated saver rejects
embedded HTML, so the route treats this output as trusted generated content.
Stories also download a stored PDF and use the shared quiz drawer. There is no
separate story client or a static chapter directory.

Opening a quiz resets local navigation and answer state, fetches only the prompt,
mode, options, and order for the selected content item, and checks whether a
learner session exists. Choice options receive a fresh display permutation each
time the drawer opens, but the UI maps a click back to the original persisted
option index before posting it. Typed answers and spoken-work prompts travel
through the same injected record interface. The server returns a result only
after it has checked authentication and recorded an attempt; then the drawer
marks choice and typed responses correct or incorrect, while spoken-work
responses remain ungraded and reveal their reference explanation. The browser
never starts with the correct option, accepted typed forms, or reference answer.

The production flow is deliberately narrow. The repository-root Dockerfile
copies the application manifest and lockfile, performs a clean install, copies
the application source, builds the Nitro output, and places only that output in
the Node runtime image. The hosting platform supplies runtime variables and
executes the generated server. This respects the platform's root-Dockerfile and
root-build-context contract while preserving the application as a standalone
package.

# module-relationships

The app is the runtime consumer of the database schema. It reaches that
persistence layer only through the domain-services child, whose server functions
are invoked by SSR loaders and client event handlers. That direction matters:
routes may request a lesson, a chapter, a catalog, a PDF, or an answer verdict,
but they may not create a browser-side database client or expose the connection
string. The same boundary prevents a quiz response from leaking answer keys in
the initial fetch. If a query shape, table column, or content status policy
changes, the server-function return type and the route that renders it need
review together.

The content-generation parent is an upstream producer rather than a runtime
dependency installed into the app image. Its math child validates a curriculum
ledger, saves lesson HTML and decks, and makes a deterministic curriculum entry
available by creating the corresponding lesson row. Its biography child saves a
story, ordered chapters, questions, section ranges, and printable PDF. The app
then consumes those rows through the domain child. The consequence is that
content changes can alter catalog availability, navigation, rendering, and quiz
modes without changing application code, while an application change must remain
compatible with generated content already stored in the shared database.

The two application children meet at explicit server-function contracts. The
domain child selects and filters data, turns stored Markdown into reader HTML,
authenticates the learner, normalizes typed mathematical input, and records
events. The learner-experience child presents those results in routes and
components, owns temporary visual state, and invokes the POST operations. The
parent coordinates their shared lifetime in the shell and owns the framework
entry points that make those operations SSR-capable.

The root document also establishes a relationship with an external KaTeX CDN.
Courseware and quiz prompts can contain KaTeX delimiters; the document loads the
stylesheet, runtime, and auto-render helper, while the quiz drawer calls the
helper only after the relevant DOM is present. Generated courseware is shown in
an iframe and may include its own rendering support, so visual changes involving
mathematics need verification in both the parent page and the embedded document.

The application is deployed by a container platform that assumes a
repository-root Dockerfile and build context. That platform injects the database
connection string in production. Locally, the application shares the ignored
root environment file through a symlink arrangement. The production image is
not responsible for installing or running the content-generation skill package;
those scripts have their own dependency environment and persist data separately.

# constraints

The application must remain a single standalone package under `app/`. There is
no root package manifest to use for app commands or container installation. The
Vite configuration intentionally reads environment values from the parent
directory so the app and content tools share one secret source without copying
secrets into version control. The database connection is server-only, and the
browser must never receive its URL. Any new read or write should use the existing
server-function and domain-client boundary rather than creating a second access
path.

Answer-key secrecy is a cross-module invariant. Initial question delivery may
contain prompts, modes, options, and display order only. Correct indexes,
accepted typed strings, and explanatory answers remain server-side until a
logged-in learner submits a response. Presentation-layer option shuffling must
continue to submit the original option index, otherwise correct server-side
grading would become detached from the visible selection. The quiz UI also needs
to preserve the distinction between graded choice/input responses and ungraded
spoken-work responses.

Lesson availability is not manually maintained in the catalog. The fixed
curriculum defines titles and deterministic positions, and persisted lesson ids
determine which entries become clickable and participate in next/previous
navigation. Story navigation is database authored. The lesson iframe must retain
its sandbox and responsive height handling, and generated route output must not
be hand-edited. Deployment must keep the Dockerfile and build context at the
repository root because the hosting workflow depends on that location.

# known-limits

The overview presents fixed progress numbers and a mock progress bar; it does
not yet derive learner progress from answer events. There is no general
progress-read model in the runtime despite durable answer-event tables.

Session signing falls back to a development secret when no environment value is
set. A production environment therefore depends on correct secret injection.
KaTeX also depends on CDN availability because it is not bundled. The Playwright
configuration has no enabled local web-server block, so end-to-end runs require
an already-running compatible application or an explicit base URL.

The current product has a compact route set only. Unknown lesson identifiers may
render a page-level empty content state, and there is no dedicated route-level
not-found treatment for missing persisted courseware beyond the router's generic
not-found component.

# notes-for-ai

Start cross-cutting application work by deciding whether the change belongs in
the server-side domain child, the learner-experience child, or the parent
composition. Keep the parent focused on integration. For a feature that changes
what content appears, inspect the relevant server function, schema contract, and
content saver before changing a loader or component. For a feature that changes
how a learner interacts with content, trace the route, the shared shell, the
quiz drawer if practice is involved, and the relevant CSS classes as one flow.

When touching lesson or story presentation, verify the actual browser behavior.
Check desktop and mobile shell geometry, catalog opening and closing, route
transitions, content absence states, PDF downloads, and whether embedded lesson
documents remain sized without horizontal overflow. For quiz changes, test all
three math answer modes and both story modes, including the logged-out gate,
option shuffling, retryable transient failure behavior, and delayed answer
reveal. Confirm that a page inspection before a submission cannot find answer
keys or typed-answer acceptance data.

For framework or build work, preserve the standalone manifest and root
environment resolution. Run the unit suite with its isolated Vitest
configuration, then build the application so the Start/Nitro integration is
exercised. Run targeted browser tests against a real server when route or iframe
behavior changes. Do not edit generated routing output; make route changes in
the authored route modules and let the router tooling update the generated tree.

Before changing the deployment surface, inspect the root Dockerfile and ensure
the image still installs from the application lockfile, builds the SSR output,
and starts the generated server. Keep application runtime dependencies separate
from the content skill dependencies. A change that seems local to styling can
still affect the persistent catalog, mobile scrim stacking, reader typography,
or quiz feedback layout, so validate it in the complete shell rather than in an
isolated component alone.
