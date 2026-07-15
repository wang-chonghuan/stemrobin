# n-im intent — STEMROBIN-23 · en-translation

> prodfarm cap9 组合：工单全文 + live charter + evodocs。Batch 0004 · Seed STEMROBIN-18（full delegation）· plane。
> 已交付：T1(19) JSONB schema；T2(20) 生成器 JSONB-first；T3(21) 16 课已迁入 JSONB SSOT（sr_lessons.content/exercises、sr_content_ledger、sr_lesson_i18n('zh')、每卡 read_check）。

---
## 一、交付工单 STEMROBIN-23（描述全文）

## Meta
- Type: enabler
- Batch: 0004-jsonb-card-reading
- Origin: seed
- Seed: [STEMROBIN-18](https://app.plane.so/intentmill/projects/556c9df8-f5ac-435a-8abd-53bc522dd8a7/work-items/0b766852-f1d2-45a0-b6d9-94f2e0cad239)

## Scope
提供把 `zh` 源 JSONB 翻成 `en` 的译文流程：对课文卡片、read-check、练习 deck 的散文类文本产出英文，落为 `en` 文本覆盖层并记源修订；数学公式与图形与源一致、不翻译。经独立评审后落库。对 16 篇已迁移课产出英文覆盖层。

## Constraints
- 只译散文；公式/SVG/数值继承源、逐字节一致，不改写。
- 覆盖层记源修订供陈旧检测；不得把答案 KEY 复制进覆盖层或浏览器初次响应。
- 译文由开发 agent 撰写、经确定性 saver 落库；不引第三方翻译 API、不新增经常性成本。
- 经独立评审（散文忠实 / 公式一致 / 无 KEY 泄漏）后方可落库。

## Acceptance criteria
- 16 篇已迁移课的卡片、read-check、练习，均有可查询到的 `en` 覆盖层文本。
- 任取一课，其 `en` 呈现中的数学公式与 `zh` 源一致（未被翻译或改动）。
- `en` 覆盖层数据中不含正确答案/接受串等 KEY。

---
## 二、Charter（live 注入）

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

---
## 三、相关 evodocs 模块

### mod--content-generation--math-courseware database-schema app--domain-services
```markdown
```
