# n-im intent — STEMROBIN-38 · en-brand

> prodfarm cap9 组合。Batch 0006-titles-auth-cleanup · Seed STEMROBIN-32（full delegation）· plane。已含 33(解锁练习)+37(删传记)。

## 一、交付工单 STEMROBIN-38

## Meta
- Type: fix
- Batch: 0006-titles-auth-cleanup
- Origin: seed
- Seed: [STEMROBIN-32](https://app.plane.so/intentmill/projects/556c9df8-f5ac-435a-8abd-53bc522dd8a7/work-items/fd154fe1-271e-4986-bf25-f17b6d2d1631)

## Scope
现象：英文时品牌仍显示"知更"，英文 slogan 换行难看（当前处理不可接受）。期望：locale=en 时品牌显示 **stemrobin**（非"知更"）；英文 slogan 过长则**不显示**。

## Constraints
- 只改品牌/slogan 呈现；中文时不变（"知更" + 中文 slogan）。
- 不引新依赖。

## Acceptance criteria
- 切英文，品牌显示 "stemrobin"。
- 英文下 slogan 不再出现难看的多行换行——过长即隐藏。
- 切回中文，品牌与 slogan 照旧（知更 + 中文 slogan）。

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
