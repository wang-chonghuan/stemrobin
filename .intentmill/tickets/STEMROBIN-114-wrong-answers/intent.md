## Ticket

### Meta
- Type: story
- Batch: 无
- Origin: human
- Seed: 无
- Lane: express

### Scope
学习者答错教材练习后，可以从侧边栏个人资料菜单进入错题本，按日期查看错误记录，并重新作答对应题目。每条记录显示教材书号、题号和错误发生的 UTC 时间；页面当前只提供按日期查看，并为后续增加其他视图保留清晰入口结构。

### Constraints
- 错题记录必须持久化到数据库。
- 入口位于侧边栏个人资料下拉菜单。
- 当前仅支持教材练习题，不纳入课文检查题或英语背诵。
- 错误历史在后续答对后仍保留。

### Acceptance criteria
1. 已登录学习者答错一道教材练习后，从个人资料菜单进入错题本，可看到该记录按日期分组，并显示书号、题号和 UTC 时间。
2. 学习者从任一错题记录选择重做后，会进入对应教材练习并定位到该题，可以再次提交答案。

## Live Charter

### Product Goal

> DRAFT derived from resources/content/intent.md — AWAITING HUMAN CONFIRMATION.

为一名 8 岁、理解力强的孩子提供**初中数学/物理**的自学课程产品。核心原则:**内容按初中标准(2022 版义务教育课标),解释按儿童认知,训练按严肃教材**——不阉割概念,重排入口与坡度。

产品形态:web 课程应用,三层材料——教师版知识骨架、学生版讲义(课文页)、练习题系统(识别/表示/基础操作/反向推理/易错辨析五类题)。

学习方式:课文页采用**卡片式精读**——课文不变、按语义打散成带编号的卡片,一次读一张,读完当场以轻量"读没读"题(read-check)卡关,防止跳读/假读;走完全部卡片才算读完课文,之后进入练习题系统。

多语言:产品面向**多语言学习者**(目标 7–8 种语言,首个为英文),数学内容以中文为源语言,学习者可切换语言学习;数学公式统一用标准数学记法、跨语言共享。(人确认 2026-07-14)

#### 第二支柱:短文学英语(人确认 2026-07-20)

以约 60 篇适合 8–12 岁的短文/对话,通过"读懂 → 提示递减 → 全文默写 → 周期复习"让孩子有机记住 VOA1500 核心词。遵循同一原则(内容按严肃教材、解释按儿童认知)。当前中英双语,后续多语言。

达成度判定标准:(awaiting human — 例如"数学 stage-N 全部课文与练习可用且孩子可独立完成一课")

### Redlines

1. Destructive or first-time writes to external systems: cloud resource creation/deletion beyond the established n-easyapp redeploy path, public publishing, sending mail/messages.
2. Irreversible data operations: deleting or polluting accumulated production data (the shared PostgreSQL schema for stemrobin).
3. Spend above threshold: any action incurring new recurring cost or one-off cost > $5.
4. Modifying `.prodfarm/charter/goal.md` (the product north star).

### Engineering Rules

1. Think before coding. Do not assume or hide confusion; surface tradeoffs and ask when the requirement is genuinely unclear.
2. Simplicity first. Write the minimum code that solves the requirement and add no speculative feature or abstraction.
3. Surgical changes. Touch only what the ticket requires and preserve unrelated work.
4. Goal-driven execution. Define verifiable goals and verify by running the product.
5. SSOT and one way only. Keep one source of truth and no shadow workflow or silent fallback.
6. Secrets stay in ignored environment files and must never be printed, staged, or committed.
7. Database access is server-only through `app/src/lib/db.ts` `sql()` against the shared Azure Postgres schema `stemrobin-schema`.
8. Answer keys must never be sent in initial browser payloads; correctness remains server-side.
9. Generated content rows are written only through their content skill saver scripts.
10. Schema changes belong in `ssot-schemas/db-schemas/stemrobin.sql`, never ad hoc.
11. The root Dockerfile and build context stay at repository root; the Container App keeps at least one replica.
12. Do not add, remove, or change a dependency when the existing stack can implement the requirement.

### Architecture

- The deployed product is one TanStack Start SSR application under `app/`, using React 19 and TypeScript.
- File-based routes live under `app/src/routes`; protected learner routes live under the pathless `_app` parent.
- Domain services live under `app/src/lib`; all PostgreSQL access uses the shared `sql()` client.
- Routing uses `@tanstack/react-router`; state uses Zustand; styling follows the existing teal, green, and white design system.
- Authentication uses the existing signed HTTP-only session cookie and `sr_users`.
- Content and learner state use the shared PostgreSQL server and quoted `stemrobin-schema`.
- Initial answer payloads remain key-free; judging happens in server functions.
- Existing answer-event tables are runtime learning state. `sr_content_answer_events` records JSONB-node responses with learner, lesson, kind, node id, correctness, submitted response, locale, and timestamp.
- No new dependency, second app, second database client, framework change, or external auth service is authorized.
- App commands run from `app/`; deployment uses the root Dockerfile and the established Azure Container Apps redeploy path.

### Runbook

- Install: `cd app && npm install`.
- Develop: `cd app && npm run dev`; the fixed local port is 3200.
- The root `.env` is ignored and contains database/runtime secrets. Local SSR uses `app/.env -> ../.env`.
- Unit tests: `cd app && npm run test`.
- Production build: `cd app && npm run build`.
- E2E: `cd app && npm run e2e`.
- Database schema SSOT: `ssot-schemas/db-schemas/stemrobin.sql`.
- Redeploy: use the established n-easyapp redeploy capability for project `stemrobin`.
- Live URL: `https://lemmadeck.com`.

## Relevant Module Facts

### Application shell and learner experience

- The pathless `_app` layout performs the single protected-route authentication check and keeps the catalog/sidebar mounted around nested routes.
- The catalog/sidebar already owns the current learner identity, locale control, profile dropdown, logout, and responsive desktop/mobile behavior.
- Protected learner content must remain under `_app`; do not create per-page authentication variants.
- The lesson route renders card reading, full-text mode, and practice for one deterministic lesson identity.
- The UI does not decide correctness. It submits answers and consumes server-owned verdicts.
- Route and UI work must be verified in the running product at desktop and mobile widths.

### Textbook exercise answering

- `checkTextbookAnswer` judges a submitted textbook exercise on the server.
- Authenticated submissions write `sr_content_answer_events`.
- Textbook exercise events use the same stable lesson identity and exercise node id shown to the learner.
- The event row includes `user_id`, `lesson_id`, `kind`, `node_id`, `is_correct`, response data, locale, and `created_at`.
- Initial textbook data shown to the browser must remain answer-key-free.
- Existing error-event history is event data; later correct events do not need to rewrite earlier rows.

### Database

- `sr_content_answer_events` is the existing durable runtime event source for JSONB exercise and read-check responses.
- The table is already indexed by user and lesson.
- This ticket does not require a schema or migration if the existing event columns can answer the requested view.
- All reads and writes stay server-only through the shared SQL client.
- Do not hand-write generated content rows or alter lesson/exercise identities.

## Execution Direction

Implement the ticket through established route, server-function, sidebar-menu, localization, and CSS patterns. Reuse the existing textbook answer events as the single mistake-history fact source if code inspection confirms their exercise kind and identifiers are sufficient. Add one ticket-scoped Playwright acceptance script that proves both acceptance criteria with the real running product and database-backed answer flow. Do not expose answer keys or add a database schema.
