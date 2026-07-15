# n-im intent — STEMROBIN-35 · 显示课文与 section 标题及速览课后题

> prodfarm cap9 组合。Batch 0006 · Seed STEMROBIN-32（full delegation）。已含 33(解锁练习)/34(恢复 section 中文名入 content JSONB, card.name 已存在)/37(删传记)/38(英文品牌)。
> 依赖 STEMROBIN-34 已交付：sr_lessons.content 每卡现有 name(section 中文名)；sr_lessons.title 为课文标题。

## 一、交付工单 STEMROBIN-35

## Meta
- Type: story
- Batch: 0006-titles-auth-cleanup
- Origin: seed
- Seed: [STEMROBIN-32](https://app.plane.so/intentmill/projects/556c9df8-f5ac-435a-8abd-53bc522dd8a7/work-items/fd154fe1-271e-4986-bf25-f17b6d2d1631)

## Scope
卡片精读与全文速览都显示**课文 title** 与**每个 section 的标题**（中文名）；全文速览里**也显示课后题**（传统教材式，只呈现题目，不在速览里判分/计进度）。

## Constraints
- 依赖 section 中文名已恢复（本 seed 另一单）。
- 速览里课后题**只显示、不作答判分、不推进进度**；正式作答/判分走练习流程。
- 公式渲染正常、移动端不横向溢出；沿用登录门禁。

## Acceptance criteria
- 打开课，卡片精读显示课文 title 与当前卡的 section 标题。
- 切全文速览，整篇含课文 title + 各 section 标题 + 课后题（题目可见）。
- 速览里的课后题不作答判分、不使练习/课文进度变化。

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

### mod--app--learner-experience
```markdown
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
```

### mod--app--domain-services
```markdown
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
```
