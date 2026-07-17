# purpose

The domain-services module is StemRobin's trusted server-side policy layer for math learning. It turns the shared PostgreSQL schema into locale-complete, browser-safe curriculum, reading, practice, identity, and progress data. It owns every decision that must not be duplicated in the browser: database access, session verification, locale resolution, content availability, answer-key separation, answer judgment, attempt scoring, and progress aggregation.

The module bridges a hybrid content model. Card reading comes from neutral JSONB stored on a lesson plus a prose-only locale overlay. Practice uses relational question rows for stable runtime identities and answer events, while exercise JSONB and overlays provide translated prompt and option text. Stored HTML/PDF remain derived lesson artifacts. The module keeps these representations aligned behind server-function contracts so components do not need to understand storage details.

The central security rule is phase separation. Initial reading and practice fetches include prompts, visible options, order, and presentation metadata only. Correct indexes, accepted forms, and reference answers remain in neutral JSONB or privileged relational columns. The server reads hidden data only when judging a submitted response. Locale overlays are never a second location for answer keys.

# structure

The database boundary is a memoized Postgres client configured for TLS, a small connection pool, connection recycling, and the quoted `stemrobin-schema` search path. It accepts the local authoring connection variable or deployed runtime variable and fails immediately when neither exists. All services use this one client; there is no browser database SDK or feature-specific connection.

Curriculum logic owns the fixed math and physics outline, deterministic lesson ids, learner-visible numbering, locale-specific labels, availability projection, and previous/next navigation. Chinese uses the full source outline and marks only persisted/readable lessons as links. A translation locale receives only lessons in the supplied readable-id set, with empty stages and subjects removed. This keeps future untranslated placeholders from appearing as partially supported English content.

Locale support has two layers. Isomorphic translation helpers provide application chrome, curriculum labels, lesson titles, and question-type labels. Server-only locale primitives read and write a long-lived `sr_locale` preference cookie. Loaders resolve locale on the server so content overlay selection and first paint agree. Unknown cookie values fall back to Chinese.

Lesson services read metadata, stored HTML, PDF bytes, and locale-readable ids. Readability is calculated from all node ids referenced by card prose, figure captions, card checks, exercise prompts, and exercise options. A lesson is available only when the selected overlay covers every referenced id. This is stricter than row existence and prevents mixed-language rendering.

Reading services project neutral cards into browser-facing cards. Ordered body nodes combine locale prose with neutral formulas and SVG. Read-check prompts and options are resolved from the overlay while their keys are omitted. A missing overlay node fails projection; the server returns no card reading rather than emitting blanks. The stored lesson head is extracted from derived HTML so each card iframe can reuse the same KaTeX and visual contract.

Practice services expose key-free relational questions. Chinese uses relational prompt and option text. Other locales align relational rows with exercise JSONB by order and resolve prompt/option node ids from the overlay, while retaining numeric question ids and hidden relational keys for scoring. Separate attempt operations start, resume, restart, end, summarize, and retrieve the latest score.

Session services isolate Node crypto and server cookie APIs. Passwords are verified against scrypt hashes. The session value contains only a numeric user id and HMAC signature. Progress services combine lesson read-check definitions, correct content events, and the latest scored practice attempt into two possible points per lesson.

# flows

A shell or overview load first verifies the session in the parent route, then asks this module for the active locale and readable lesson ids. The availability query enumerates every translatable node referenced by content and exercises, joins the requested overlay, and accepts only lessons with zero missing nodes. The curriculum projection then supplies localized labels and navigation in deterministic outline order.

A card-reading request selects neutral content, stored HTML, and the active locale overlay. It rejects missing or empty card trees. Projection preserves card order, learner-visible card numbers, section names, anchors, formulas, SVG, and captions. Read-check objects contain only id, mode, prompt, and visible options. A choice submission compares the original option index with the hidden JSONB index; an input submission normalizes both typed text and accepted forms. Logged-out read-checks can be judged, but only authenticated learners produce `sr_content_answer_events`.

A practice fetch selects only visible relational question columns. For English, it obtains the lesson exercise JSONB and overlay and substitutes localized prompt/option text by exercise order. The answer recorder requires a valid session, then selects hidden relational key columns. Choice and input responses are graded; work responses remain ungraded. Answer events can carry an attempt id so the drawer can reconstruct one pass through the deck.

Starting an attempt deletes any existing open attempt for the same learner and lesson, relying on cascade behavior to clear its linked answer events. Resuming reads the latest open attempt and collapses multiple events per question to the newest event. Ending stamps `ended_at`, summarizes the current deck against recorded events, counts unanswered gradable items in the denominator, excludes work items from the percentage, and records that same server-authoritative percentage in practice progress.

Progress treats each lesson as one locale-agnostic identity. Reading is complete only when the lesson has at least one read-check and every defined check has a correct event for the learner. Practice is complete when the latest stored score is at least eighty. A later lower score makes practice incomplete again. The writer retains only the latest two practice score rows per learner and lesson. Logged-out progress returns correct totals with no completed points.

Login trims and lowercases email, verifies the stored hash, and writes the signed cookie. Logout expires it. The current-user operation verifies the signature and confirms the user row still exists. Locale switching writes its separate non-httpOnly preference cookie and causes route loaders to rerun.

# module-relationships

The database-schema module owns table, column, index, and cascade contracts. This module consumes users, lessons, content/exercise JSONB, overlays, relational questions, content answer events, relational answer events, quiz attempts, and practice attempts. Some critical validity remains above SQL: JSONB shape, complete overlay coverage, answer-mode companion fields, latest-two pruning, and progress interpretation.

The math-courseware generator is the upstream writer. It validates and saves stage ledgers, card trees, exercise decks, Chinese overlays, relational practice rows, and derived HTML/PDF. Translation tools add complete overlays. Any change to node identity, exercise order, key placement, or rendering metadata must be reviewed against the projections here. The application never regenerates source content.

The learner-experience module is downstream. It consumes safe view models and calls mutations for locale, session, read-checks, answers, attempts, and progress. It may shuffle choice presentation, but it submits original indexes. It must not infer overlay fallback, calculate authoritative scores, query hidden keys, or reconstruct progress from local state.

The app parent supplies SSR transport, the protected route gate, and the runtime environment. Curriculum labels are code-owned companion data rather than generated database content. The same deterministic lesson id connects outline order, JSONB, overlays, questions, attempts, and progress.

# constraints

All database access stays server-only through the shared client. Preserve the quoted schema path and connection recycling behavior. Do not add a second client, expose the connection string, or import server-only crypto/cookie modules into browser code.

Answer keys remain separated from fetch payloads and overlays. Reading projection must not emit JSONB `key` objects. Practice fetches must not select `correct_index`, `accept`, or `answer`. Server record operations may reveal feedback only after validation and judgment. Non-Chinese practice currently suppresses Chinese explanations rather than falling back to mixed-language feedback.

Locale availability is all-or-nothing. Missing translated nodes hide card reading and catalog availability. Node ids and exercise order are cross-storage contracts; changing them can break translation, question localization, progress, and answer history even when individual JSON objects still parse.

Progress is server-authoritative and locale-agnostic. Reading requires every current read-check, and a lesson with no checks does not complete vacuously. Practice uses the latest score and can regress. The attempt score shown in the drawer and the score written to progress must continue to use the same calculation.

# known-limits

The content model remains hybrid. JSONB owns neutral lesson and exercise structure, but practice answering and attempt resume depend on relational `sr_questions`. Exercise order is the alignment key between them. A migration that changes one side without the other can localize the wrong question or detach keys from visible text.

English reference explanations are not translated. After a response, English learners receive the verdict and choice highlighting but an empty explanation field. This avoids mixed-language output but provides less teaching feedback than Chinese.

Authentication has no registration, password reset, roles, server-side revocation, or external provider. The development session-secret fallback is unsafe for production if environment injection is omitted.

Progress history is intentionally lossy. Only the latest two score summaries are kept, content events are disposable, and question replacement can remove relational answer events through cascades. The model supports current learner feedback rather than longitudinal analytics.

# notes-for-ai

Before changing a service, identify its authority: curriculum code, neutral JSONB, locale overlay, relational question row, attempt row, or progress summary. Avoid creating fallback data paths between them. A missing overlay, key, user, or database configuration should remain visible as an unavailable or error state rather than being silently synthesized.

For localization changes, test complete and incomplete overlays, Chinese source behavior, English filtering, card projection, practice text alignment, and explanation suppression. Preserve formulas, SVG, stable node ids, and key-free overlays. For curriculum changes, coordinate human titles, deterministic ids, generated lesson rows, and localized title maps.

For practice changes, test initial key-free fetches, choice/input/work judgment, option shuffling, open-attempt replacement, resume hydration, early end, latest score retrieval, and progress recording. Verify cascade consequences in a disposable database. For progress changes, test zero-check lessons, all-check completion, exact eighty threshold, regression, latest-row ordering, and logged-out totals.

Run the focused Vitest suites for curriculum, reading, locale, quiz, normalization, and progress, then run the production build. When storage contracts change, inspect the schema and generator saver in the same change and verify the browser-visible network payload before and after answering.
