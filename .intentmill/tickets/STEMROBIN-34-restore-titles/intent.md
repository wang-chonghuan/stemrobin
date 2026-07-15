# n-im intent — STEMROBIN-34 · restore-titles

> prodfarm cap9 组合。Batch 0006-titles-auth-cleanup · Seed STEMROBIN-32（full delegation）· plane。
> 已交付：batch 0004/0005（JSONB SSOT、逐卡精读、英文数学、纯选择题、公式修复、全文速览、进度条、登录门禁）。

## 一、交付工单 STEMROBIN-34

## Meta
- Type: enabler
- Batch: 0006-titles-auth-cleanup
- Origin: seed
- Seed: [STEMROBIN-32](https://app.plane.so/intentmill/projects/556c9df8-f5ac-435a-8abd-53bc522dd8a7/work-items/fd154fe1-271e-4986-bf25-f17b6d2d1631)

## Scope
卡片节点丢了 section 中文名（迁移后只剩 anchor+num），全文速览也没课文 title。写**临时恢复 skill**：从原始来源（STEMROBIN-21 迁移快照 / 原 HTML 的 `sr-sec-name` / 等价来源）恢复每卡 section 中文名，写入 content JSONB；并改数学生成器 `sr-math-lesson` 今后必产 section 中文名。

## Constraints
- 恢复走确定性脚本、幂等、留快照；不改课文正文实质（仅补 section 名）。
- 生成器改动保持既有 JSONB 契约与教学契约；section 中文名成为卡片节点的必备字段。
- 经确定性落库，不手写数据行；不动 `sr_users`。

## Acceptance criteria
- 恢复后 16 课每卡在 content JSONB 里都有 section 中文名。
- 用改后的生成器新产一篇样例课，其每卡也带 section 中文名。
- 课文 title 可从 `sr_lessons.title` 取到（供渲染用）。

## 二、Charter（live）

### charter/goal.md
```markdown
# Product Goal

> DRAFT derived from resources/content/intent.md — AWAITING HUMAN CONFIRMATION.

为一名 8 岁、理解力强的孩子提供**初中数学/物理**的自学课程产品。核心原则:**内容按初中标准(2022 版义务教育课标),解释按儿童认知,训练按严肃教材**——不阉割概念,重排入口与坡度。

产品形态:web 课程应用,三层材料——教师版知识骨架、学生版讲义(课文页)、练习题系统(识别/表示/基础操作/反向推理/易错辨析五类题)。

学习方式:课文页采用**卡片式精读**——课文不变、按语义打散成带编号的卡片,一次读一张,读完当场以轻量"读没读"题(read-check)卡关,防止跳读/假读;走完全部卡片才算读完课文,之后进入练习题系统。

多语言:产品面向**多语言学习者**(目标 7–8 种语言,首个为英文),数学内容以中文为源语言,学习者可切换语言学习;数学公式统一用标准数学记法、跨语言共享。(人确认 2026-07-14)

达成度判定标准:(awaiting human — 例如"数学 stage-N 全部课文与练习可用且孩子可独立完成一课")
```

### charter/redlines.md
```markdown
# Redlines — actions requiring human approval

> Closed enumeration; execution looks up, never judges. Human-confirmed 2026-07-08.

1. Destructive or first-time writes to external systems: cloud resource creation/deletion beyond the established n-easyapp redeploy path, public publishing, sending mail/messages.
2. Irreversible data operations: deleting or polluting accumulated production data (the shared PostgreSQL schema for stemrobin).
3. Spend above threshold: any action incurring new recurring cost or one-off cost > $5.
4. Modifying `.prodfarm/charter/goal.md` (the product north star).
```

### charter/engineering-rules.md
```markdown
# Engineering Rules

Engineering norms a coding agent must obey on this repo. Human-authored, read whole, injected with the charter into every ticket. (Migrated from the former root `AGENTS.md` rules page; `AGENTS.md` is now a thin router.)

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.** State assumptions explicitly; if uncertain, ask. If multiple interpretations exist, present them — don't pick silently. If a simpler approach exists, say so. If something is unclear, stop, name it, ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.** No features beyond what was asked; no abstractions for single-use code; no configurability that wasn't requested; no error handling for impossible scenarios. If 200 lines could be 50, rewrite it. "Would a senior engineer say this is overcomplicated?" → if yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.** Don't improve adjacent code/comments/formatting; don't refactor what isn't broken; match existing style. Remove imports/vars/functions your change orphaned; don't delete pre-existing dead code unless asked (mention it). Every changed line traces to the request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.** Turn tasks into verifiable goals ("fix the bug" → "write a test that reproduces it, then make it pass"). For multi-step work, state a brief plan with a verify check per step. Verify by actually running (browser / commands), not by imagining from code.

## 5. SSOT and One Way Only

**One source of truth, one canonical path per operation, no fallback for impossible states.** Keep exactly one SSOT per contract/schema/decision; no parallel definitions, duplicate configs, or shadow workflows. If a source of truth is missing/violated, fail fast and surface it — never add a fallback that hides an impossible state.

## Project specifics (proven on this repo)

- **Secrets**: `.env` is git-ignored and holds DB/API secrets — never stage, commit, or echo it; verify it is not staged before every commit.
- **DB access is server-only**: all reads/writes go through `app/src/lib/db.ts` `sql()` (the browser never holds the connection string). The DB is the shared Azure easy-app Postgres, schema `stemrobin-schema`.
- **Answer-key secrecy**: quiz question fetchers (`getLessonQuestions`/`getStoryQuestions`) must never send `correct_index` / `answer` / `accept` to the client; correctness is judged server-side in the `record*` server fns.
- **Content is DB-driven, skill-generated**: never hand-write `sr_*` rows; math lessons/decks and biographies are produced by `sr-math-lesson` / `sr-story` and persisted only via their `save-*.mjs` scripts (which read repo-root `.env` and resolve `node_modules` from repo root). Schema changes go through `ssot-schemas/db-schemas/stemrobin.sql` (applied via psql), never ad hoc.
- **Deploy invariant**: Dockerfile + build context stay at repo root; the Container App runs at `--min-replicas 1` (no scale-to-zero).
```

### charter/architecture.md
```markdown
# Architecture

- **Repo layout** (unified prodfarm shape): `app/` = the web app, a **standalone project** with its own `package.json`/`node_modules` (no repo-root `package.json`); `ssot-schemas/db-schemas/` = DB SSOT; `resources/` = all committed human/curated material (`resources/content/` = content-generation source: math-ledger + course-gen guides; `resources/reference/` = human docs incl. `DESIGN.md`); `infra/` = deploy/substrate notes; `.agents/skills/` = content-generation skills (own `package.json` for their `postgres` dep). No top-level `jobs/` (this project has no independently-packaged jobs). Root holds only cross-cutting files: the deploy `Dockerfile`, `.prodfarm/` charter, `AGENTS.md`, and tooling config.
- Single tanstack-start app; SSR routes under `app/src/routes/_app/` (index = catalog, `lesson.$id`, `story.$id`, `login`).
- Domain libs in `app/src/lib/`: `curriculum.ts` (course structure + lesson ordering/nav), `lessons.ts`, `stories.ts`, `quiz.ts` + `answer-normalize.ts` (practice, incl. `input`-mode server-side judging), `session*.ts` (auth), `db.ts` (postgres access, `search_path` = the project schema).
- Content is **generated by project skills, stored in the DB** (not files): math lessons via `sr-math-lesson` (concept ledger `resources/content/math-ledger/stage-*.json` → 課文 html + exercise deck json + print PDF); biographies via `sr-story` (public-domain book → narrative markdown chapters). The app renders stored html/md; PDFs are pre-rendered at save time.
- `ssot-schemas/db-schemas/stemrobin.sql` is the single source of truth for the DB tables (`sr_lessons`, `sr_questions`, `sr_stories`, `sr_story_chapters`, `sr_story_questions`, `sr_answer_events` + story variant, `sr_users`).

## Project rules

- (awaiting human: architectural rules accumulate here via boundary settlement / ADR-bearing timeline entries)

## Complexity hotspots

- (awaiting real aborts: knowledge/complexity blind spots that caused a batch abort promote here at boundary settlement)

## Stack & constraints

- **Base**: tanstack-start (SSR full-stack, single app in `app/`), React 19, TypeScript, running on Node 24. Vite builds the app through the TanStack Start and Nitro plugins. This is the one supported n-easyapp base for this repo; a second app / a framework change is out of scope without a charter decision.
- **Layout**: the app is a standalone project under `app/` (`app/package.json`, `app/package-lock.json`, `app/node_modules`); commands run from `app/` or via `npm --prefix app`. No repo-root `package.json`. `app/vite.config.ts` sets `envDir: '..'` so build-time env resolves from the root `.env`.
- **Routing**: `@tanstack/react-router` (file-based, `app/src/routes/`).
- **Styling**: Tailwind CSS 4 (+ tw-animate-css), Geist / Bricolage / Hanken / JetBrains Mono fonts. Three-color palette per `resources/reference/DESIGN.md` (teal-blue, green, white) — no new hues.
- **State**: zustand (`app/src/lib/layout-store.ts`).
- **Data**: PostgreSQL via the `postgres` client (`app/src/lib/db.ts`); the DB is the Azure easy-app **shared** server, per-project schema `stemrobin-schema` — never a second client, never scale-to-zero. Session via `app/src/lib/session.server.ts` (HMAC cookie).
- **Authentication**: no external auth provider. Passwords use Node `crypto` scrypt hashing and sessions use an HMAC-signed httpOnly cookie in `app/src/lib/session.server.ts`.
- **Content pipeline**: markdown via `marked`; lessons/stories/quiz served from the DB through `app/src/lib/`. KaTeX is loaded from a CDN by the root document rather than bundled from npm.
- **Build/test**: Vite + Nitro produce `app/.output`; Vitest uses the separate `app/vitest.config.ts` because the TanStack Start Vite plugin is incompatible with the Vitest runner. Run with `cd app && npm run dev|build|test|start`.
- **Deploy**: Azure Container Apps `ca-stemrobin` via n-easyapp; **Dockerfile at repo root, build context = repo root** (n-easyapp's redeploy hard-codes both). The root Dockerfile builds the standalone app: `npm ci` from `app/`'s manifest → `npm run build` → ships `app/.output`. The content skills (`sr-math-lesson`, `sr-story`, `sr-lesson`) resolve `postgres` from their own `.agents/skills/node_modules` — independent of the app. Do not move the Dockerfile.
```

### charter/runbook.md
```markdown
# Runbook

The web app is a **standalone project in `app/`** (its own `package.json` +
`package-lock.json` + `node_modules`). There is **no repo-root `package.json`**.
Run app commands from `app/` (or with `npm --prefix app`).

## Develop
- `cd app && npm install` — install app deps (into `app/node_modules`)
- `cd app && npm run dev` — vite dev server (default http://localhost:3000; check terminal output for the actual port)
- Local-dev env: the app's SSR runtime auto-loads `.env` from its own project dir, so a
  gitignored symlink `app/.env → ../.env` shares the single root `.env`. Recreate it after a
  fresh clone: `ln -sf ../.env app/.env`. (The container gets env from Azure, not this file.)

## Test / Build
> Regression: `.autoqa/` initialized (n-autoqa TS-stack support, 2026-07-07). RG cases accumulate per ticket via n-autoqa; `cd app && npm run test` (vitest) remains the unit floor. Run RG suite: n-autoqa cap3.

- `cd app && npm run test` — vitest run
- `cd app && npm run build` — production build (output `app/.output/`)
- `cd app && npm run start` — serve the built output (`app/.output/server/index.mjs`)
- `cd app && npm run e2e` — Playwright E2E (config `app/playwright.config.ts`)
- Content skills (`sr-math-lesson`, `sr-story`, `sr-lesson`) run their `scripts/*.mjs` directly
  with node and resolve `postgres` from **`.agents/skills/node_modules`** (their own manifest
  `.agents/skills/package.json`) — independent of the app's install. Set up once with
  `cd .agents/skills && npm install`.

## Database
- PostgreSQL; connection via `.env` (`EASYAPP_DATABASE_URL` / `DATABASE_URL`; obtain from n-easyapp shared PostgreSQL contract). Never commit `.env`.
- Apply the schema from the repo root: `psql "$EASYAPP_DATABASE_URL" -f ssot-schemas/db-schemas/stemrobin.sql`.

## Deploy
- Azure Container Apps app `ca-stemrobin` (n-easyapp substrate, shared env `cae-easyapp-shared`).
- Redeploy: n-easyapp redeploy cap for project `stemrobin` (builds `acreasyapp.azurecr.io/stemrobin:latest` via `az acr build`, updates the container app).
- **Build invariant**: n-easyapp hard-codes Dockerfile + build context at the **repo root**. The
  root `Dockerfile` builds the standalone app: `npm ci` from `app/`'s manifest, `npm run build`,
  then ships only `app/.output`. Do not move the Dockerfile; keep it building `app/`.
- Live URL: https://ca-stemrobin.kindsmoke-4d84c417.northeurope.azurecontainerapps.io

## Troubleshoot
- Container logs: `az containerapp logs show -n ca-stemrobin -g rg-easyapp-shared --tail 50`
```

## 三、相关 evodocs

### mod--content-generation--math-courseware
```markdown
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
```

### mod--database-schema
```markdown
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
```
