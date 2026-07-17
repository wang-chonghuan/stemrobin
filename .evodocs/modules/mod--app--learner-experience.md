# purpose

The learner-experience module is StemRobin's routed, responsive math-study interface. It turns server-owned identity, locale, courseware, questions, attempts, and progress into a protected workspace where a learner can navigate the curriculum, read one lesson closely or as a full document, download its PDF, complete practice, resume unfinished work, and inspect scores. It does not decide content validity or correctness; those policies remain in domain services.

The experience is organized around one lesson identity and two learning loops. Close reading walks numbered cards and requires each card's read-check before advancing. Practice is independently accessible and runs as a scored attempt over the lesson deck. The two loops contribute separate progress points, so the UI must not imply that opening practice completes reading or that viewing full text creates card-reading progress.

The current route set is math-only. Biography catalog sections, story pages, Markdown reading, and story quiz injection are no longer application responsibilities. The interface is localized for Chinese and English, with the server deciding which lessons are complete enough to display in the selected language.

# structure

The root route supplies the HTML document, metadata, global CSS, and KaTeX stylesheet/runtime/auto-render scripts. The router uses generated file-route output, while authored behavior lives in route modules. `/login` is a top-level public route. The pathless `_app` layout protects the overview and lesson pages, keeps the catalog mounted around the outlet, and owns desktop-versus-drawer behavior.

The catalog combines brand, language control, curriculum outline, current learner identity, and logout. Chinese displays the full source outline with unavailable lessons as plain text. English receives an already filtered curriculum and displays only complete translated lessons. Stage numbering is derived from deterministic lesson ids so removing untranslated stages does not renumber the remaining curriculum. The locale control writes a server cookie and invalidates the router, causing every loader and visible surface to re-resolve.

The overview displays real progress and readable lesson cards. It summarizes reading-complete and practice-complete lesson counts, renders completed points over total points, and sizes the progress bar from those server values. Lesson cards use localized titles and subjects and link only to locale-readable ids.

The lesson route coordinates the card reader, full-text iframe, PDF action, previous/next footer, and practice drawer. Card reading is the default when a JSONB card projection is available. Full-text mode uses the stored generated HTML. A legacy or incomplete lesson without a card projection falls back to full HTML. Both iframe forms measure their content after load, delayed resource reflow, and resize observation.

The card reader owns one session of local close-reading state. It displays one card at a time, wraps the card body in the generated lesson head, renders read-check controls outside the iframe, tracks correct and retryable wrong results, and unlocks navigation only when every check on the current card is correct. Cards with no checks pass automatically, but the learner still reaches the final card before completion UI appears.

The quiz drawer is a multi-phase dialog. It fetches the current user and visible questions, then optionally coordinates the attempt API. Its start phase shows the latest score or an unfinished-attempt choice, its quiz phase renders and records one question at a time, and its result phase shows the newly ended score. It retains randomized display order separately from original option indexes.

# flows

A logged-out request to any protected surface redirects to the bare login page. Successful login navigates home. The shell then loads readable lesson ids, locale, and user before rendering the catalog and nested route. On desktop the catalog is a persistent rail. Below the shared breakpoint it becomes an off-canvas drawer with a scrim; navigation closes it, while returning to desktop clears drawer state.

Changing language posts the selected locale and invalidates the router. The catalog, overview, lesson label, reading overlay, practice prompt text, and UI chrome are reloaded together. This avoids a client-only translation layer and prevents a first-paint language flash. English branding intentionally uses the StemRobin name without the Chinese slogan.

In close-reading mode, the card iframe receives a self-contained document assembled from the stored lesson head and one projected body. Read-check prompts and options live in the application DOM and require defensive KaTeX handling because React re-renders can restore raw delimiters after an earlier typeset. The component retries while the CDN loads and observes DOM mutations to reapply typesetting. A wrong response keeps the item active and directs the learner to reread; a correct response locks that check. Completing the last card offers practice but does not control whether practice can be opened from the toolbar.

Full-text mode renders the stored skill-generated lesson HTML, including numbered section names and key-free practice prompts. It is a viewing mode only and does not call the read-check recorder. The PDF action requests base64 bytes, creates a temporary object URL, triggers download, and revokes the URL. Previous/next navigation uses only locale-readable lessons in curriculum order.

Opening practice resets transient drawer state and shuffles each choice once for that opening. An authenticated learner with no history starts a new attempt. Existing history produces a start screen with the latest score and, when present, a resume action. Resume hydrates previous verdicts and moves to the first unanswered question. Restart creates a fresh attempt and removes the prior open one server-side.

Choice answers submit original indexes despite shuffled presentation. Typed answers preserve submitted text after judgment. Work items are self-checked and excluded from the scored ratio. Ending an attempt is allowed before every question is answered; unanswered gradable items remain in the denominator. The scorecard shows percentage, correct ratio, unanswered count, completed work count, and wrong question numbers. Ending also updates overview progress through the server.

# module-relationships

The domain-services child is the only dynamic data producer. It supplies locale, user, readable ids, card projections, question projections, attempt state, answer results, scores, and progress. This module renders those contracts and posts learner actions. It never receives database credentials or initial answer keys.

The content-generation math workflow is upstream through the database. It determines card boundaries, section names, body markup, read-checks, exercise text, generated HTML, and PDF. The learner experience therefore needs verification with real persisted artifacts, not placeholder JSX. Node ids and overlay coverage are server concerns; this module works with resolved text.

The app parent owns the protected route hierarchy, package/build configuration, and deployment composition. The root document's external KaTeX resources support app-DOM prompts and feedback, while generated HTML carries compatible styles for iframe content. CSS is a functional contract for rail/drawer geometry, card frames, quiz phases, scorecards, focus states, and reduced motion.

# constraints

Protected learner content stays under `_app`; `/login` stays outside it. Do not add per-page authentication variants or expose catalog data before the parent gate. Keep the catalog persistent around the outlet and keep its JavaScript breakpoint aligned with CSS.

Card and full-text modes have different progress semantics. Only correct read-check events count toward reading completion. Full-text viewing and practice activity must not synthesize those events. Practice remains directly openable even when cards are unfinished.

The UI must preserve answer-key secrecy. Initial question and read-check objects cannot contain keys. Choice shuffling must retain original indexes. Explanations appear only after the server response. Locale switching must not create client-selected access to an incomplete overlay.

Iframe sandboxing and dynamic height measurement are required for generated content. KaTeX handling has separate lifecycles for iframe documents, read-check DOM, question DOM, and revealed feedback. A single global typeset call is insufficient.

# known-limits

Close-reading completion is local during the current page session. Existing correct events contribute to overview progress, but the card reader does not currently hydrate prior card completion and reopen at the learner's saved position.

KaTeX is CDN-dependent and the card reader uses retry and mutation observation to recover from timing races. A network outage can still leave raw delimiters. Full generated HTML also depends on whatever external assets its stored head references.

English post-answer explanations are empty because reference explanations remain Chinese-only. The learner still receives verdict and correct-choice highlighting, but not equivalent explanatory feedback.

The login experience is intentionally minimal and offers no account creation or recovery. The Playwright configuration also requires an externally started server, so browser verification is not one-command self-contained.

# notes-for-ai

For route work, trace the parent loader and authentication gate before changing a child. For locale work, verify the complete shell after router invalidation and test both the full Chinese outline and filtered English outline. Preserve deterministic numbering when stages disappear.

For card-reader work, test cards with choice checks, cards without checks, wrong retries, correct locking, last-card completion, delayed KaTeX loading, React re-renders, and long iframe content. Confirm full-text switching does not record progress and that practice remains accessible from the toolbar.

For quiz work, test first use, latest-score display, open-attempt resume, restart, early end, shuffled choice indexes, typed input, self-checked work, retryable network failures, and scorecard totals. Inspect browser-visible data before answering. Keep attempt and scoring truth on the server.

Run unit tests for pure projections and a production build, then exercise the real UI at desktop and mobile widths. Check login redirect, logout, catalog drawer, language switch, overview progress, card/full-text modes, PDF download, lesson navigation, practice phases, focus treatment, and overflow with actual generated lessons.
