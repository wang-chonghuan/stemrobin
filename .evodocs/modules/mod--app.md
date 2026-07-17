# purpose

The application module is StemRobin's deployed learning product: one server-rendered TanStack Start application for authenticated math study. It assembles the framework runtime, protected route tree, document shell, persistent curriculum navigation, lesson reader, practice experience, progress display, build output, and production container. It does not author lessons or define database structure. It consumes database-backed courseware produced by the math content workflow and turns that material into a localized learner experience.

The current product is deliberately narrower than the historical application. Biography routes and story services are no longer part of the deployed route set. The runtime centers on math lessons with two reading representations: a card-by-card close-reading projection from neutral JSONB plus a locale overlay, and a whole-lesson view from the stored derived HTML that also feeds printable PDF output. Practice is a separate attempt-aware drawer backed by relational questions and server-side grading.

This parent module matters because the useful behavior crosses its two declared children. The domain-services child decides what content is readable in a locale, projects safe data, authenticates users, judges answers, and computes progress. The learner-experience child controls routes, temporary interaction state, responsive layout, and rendering. The parent composes those contracts into the SSR application and production artifact.

# structure

The runtime is a standalone package under `app/`, with its own dependency manifest, lockfile, source tree, tests, and installed dependencies. TanStack Start provides file-based SSR routing and server functions, Vite performs development and production builds, and Nitro emits the server artifact started from `.output/server/index.mjs`. The generated route tree is tooling output rather than an authored behavior surface. The root document supplies metadata, global CSS, icons, and external KaTeX resources.

The route hierarchy has one public route and one protected subtree. `/login` is a bare page outside the main shell. The pathless `_app` parent performs the single site-wide authentication check before protected loaders run; its children are the overview and lesson detail routes. The protected shell loads the active user, locale, and locale-readable lesson ids, then keeps the catalog mounted around the nested detail outlet. This arrangement prevents logged-out users from seeing course navigation and avoids duplicating authentication rules across pages.

The two child modules divide responsibility cleanly. Domain services under `app/src/lib` own PostgreSQL access, deterministic curriculum projection, signed sessions, locale cookies, JSONB card projection, key-free question delivery, answer judgment, quiz attempts, and progress aggregation. Learner experience owns the route modules, catalog, card reader, quiz drawer, mobile drawer state, and CSS. The parent owns their shared runtime composition plus package configuration, root document, tests, and deployment boundary.

The application includes three content representations with different authority. Neutral lesson JSONB and locale overlays are the source for card reading. Relational question rows provide stable runtime identities for the practice drawer while exercise JSONB and overlays provide localized prompt text. Stored lesson HTML and PDF are derived caches rendered by the content pipeline; full-text mode and downloads consume them without treating them as authoring sources.

# flows

A protected request first checks the signed learner session. Failure redirects to `/login` before catalog, lesson, or progress reads occur. A successful shell load reads the active `sr_locale` preference, the current user, and the lesson ids whose selected-locale overlay covers every referenced prose, caption, read-check, and exercise node. Chinese retains the full curriculum outline with unavailable lessons as placeholders. English shows only complete translated lessons and removes empty stages and subjects.

The overview maps readable ids onto the fixed curriculum and renders lesson cards in curriculum order. It also reads the learner progress model. Every lesson contributes two points: one for completing all card read-checks correctly and one for the latest scored practice attempt reaching at least eighty percent. Practice can regress after a later lower score. The overview therefore reflects server-derived event state rather than a decorative mock bar.

A lesson request loads four related views of the same lesson identity: the locale-projected card tree, stored full HTML, locale-readable lesson sequence, and active locale. Card mode is the default when JSONB content and a complete overlay are available. Each card reuses the stored lesson head for KaTeX and design styles, displays one numbered section in a sandboxed iframe, and places its read-check controls in application DOM. Correct checks unlock the next card. Whole-lesson mode displays the stored generated HTML and does not create reading-completion events. If card data is unavailable but HTML exists, the route falls back to the full document.

Practice is always openable and is not gated by reading completion. The drawer fetches browser-safe questions, the latest completed score, and any open attempt. A new learner starts an attempt immediately. A returning learner can resume the open attempt or restart, which removes the old open attempt and its dependent events. Ending an attempt scores all gradable questions, keeps unanswered gradable questions in the denominator, excludes self-checked work items, records the resulting percentage into the progress model, and presents a scorecard.

The production flow starts from the repository-root Dockerfile because the deployment substrate fixes both Dockerfile location and build context. The build stage installs from the app lockfile, runs the application build, and the runtime stage copies only `.output`. Environment variables are supplied by local root configuration or the container platform; database and session secrets remain server-side.

# module-relationships

The database-schema module defines every durable contract the app consumes: learner identity, lessons, neutral content JSONB, exercise JSONB, locale overlays, relational questions, content-node answer events, quiz attempts, and practice score rows. Domain services are the only application layer that touches those tables. Browser components receive typed projections and mutations through server functions, so schema evolution must be coordinated with both the writer and the UI contract.

The content-generation module is upstream. Its math child persists the stage ledger, neutral card tree, neutral exercise deck, Chinese overlay, relational practice rows, and derived HTML/PDF. It can also add validated translation overlays and rerender caches from current JSONB. The application does not install or execute that skill package in production. Row identity and overlay coverage determine what appears in the product.

The two application children meet at explicit behavior boundaries. The domain child resolves locale and availability, projects card and quiz text, keeps keys hidden, records attempts, and computes progress. The learner child renders those results, controls temporary state, and submits original option indexes or typed text. Moving grading, overlay fallback, or progress rules into React would create a second policy path and weaken SSR consistency.

The root document depends on a KaTeX CDN for question and application-DOM mathematics. Generated lesson HTML carries its own compatible head, and card frames reuse that head. Rendering changes therefore need checks in card iframes, the full-text iframe, read-check controls, and quiz feedback. The container platform and shared Azure PostgreSQL service form the operational downstream relationship.

# constraints

The app remains a standalone package, and app commands run from `app/`. The root Dockerfile and build context cannot move without changing the deployment substrate. All database access stays server-only through the shared client and quoted project schema. The route tree output is generated and must not be edited as the source of route behavior.

Answer-key secrecy is a cross-module invariant. Neutral JSONB and relational rows may store correct indexes, accepted forms, and explanations, but initial card and practice payloads must not include them. Locale overlays contain prose only. Choice display may be shuffled, but submissions use original option indexes. Feedback is returned only after server-side judgment; English currently suppresses untranslated Chinese explanations rather than mixing languages.

Locale availability is complete or absent. A lesson must not render a half-translated card tree or practice deck. The same deterministic lesson id anchors curriculum order, overlay rows, questions, progress, and generated artifacts. Chinese placeholders and English filtering are intentionally different catalog policies. Reading completion and practice access are also separate: practice is available immediately, while reading progress comes only from correct card checks.

# known-limits

The application still depends on externally hosted KaTeX assets, so first-load math rendering can be delayed or unavailable when the CDN fails. Components include retries and mutation-based re-typesetting, but that does not remove the network dependency.

The data model is mid-migration. Card reading uses JSONB node identities, while the attempt-aware practice drawer still uses relational question ids. Progress stores a separate scored-attempt summary after relational attempt completion. These paths are deliberately coordinated but increase the number of contracts touched by exercise changes.

Authentication remains minimal: preset database users, scrypt password hashes, and a signed user-id cookie. There is no registration, password reset, role model, server-side revocation table, or external identity provider. The session secret still has a development fallback and must be explicitly injected in production.

The Playwright configuration does not start a web server or define a default base URL. End-to-end verification requires an already-running server or explicit environment configuration.

# notes-for-ai

Classify application work before editing. Persistence, availability, localization, grading, attempts, or progress belong in domain services. Route composition, temporary interaction state, responsive behavior, and rendering belong in learner experience. Package, framework, root document, test harness, and container concerns belong at the parent level. Cross-cutting changes usually require coordinated edits in both children but should not blur ownership.

For lesson work, trace one deterministic lesson id through curriculum labeling, locale availability, card projection, full-text HTML, PDF, questions, attempts, and progress. Verify Chinese and English separately. A complete English lesson should appear with localized labels and no Chinese fallback; an incomplete overlay should hide the lesson. Confirm that full-text mode does not create reading events and that practice remains open regardless of card completion.

For practice work, inspect the server question projection, drawer phases, attempt persistence, answer event shape, score calculation, and progress recording. Test new, resumed, restarted, partially answered, and completed attempts. Inspect initial network data for hidden keys. Verify shuffled choices submit original indexes and that the score shown to the learner matches the percentage written to progress.

Run unit tests for pure curriculum, locale, reading, quiz, and progress rules, then build the application. For route or rendering changes, run the real product at desktop and mobile widths and check the protected redirect, catalog drawer, language switch, card iframe sizing, KaTeX repair behavior, full-text rendering, PDF download, practice scorecard, and logout flow.
