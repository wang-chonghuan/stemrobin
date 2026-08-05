# STEMROBIN-124 · plan

## 读代码读到的、工单没说的

- 五个脚本的连接代码是**逐字复制**的同一段：各自 `readFileSync('.env')` 手写解析、各自
  `env.EASYAPP_DATABASE_URL || env.DATABASE_URL`、各自把 `'"stemrobin-schema"'` 写进
  `postgres()` 的 `connection.search_path`。没有任何共用点，所以改一处永远漏四处 —— 这正是它
  裂开的原因，不只是一次疏忽。
- `save-lesson.mjs` 有两个连接（`sqlProbe` 探测单词发音 + 主事务 `sql`），所以调用点实际是 **6 个**，
  不是 5 个。
- `.agents/skills/` 已经是一个带自己 `package.json` / `node_modules` 的独立包，两个技能都从它解析
  `postgres`。所以共用模块放在 `.agents/skills/lib/` 下，两边都是 `../../lib/…`，对称。
- `vocab.mjs` 已经导出了 `repoRoot()`，读 `.env` 的路径解析可以复用它，不必再发明一个。
- `ssot-schemas/db-schemas/stemrobin.sql` 描述的是退役 schema。线上 `lemmadeck-schema` 多 7 张表，
  且 `sr_users` 主键列是 `user_id` 不是 `id`、`sr_lessons` 多了 `content` / `exercises` / `html`。

## 还没定的（自裁决记在 grill.md）

1. 共用模块放哪、叫什么。
2. DDL SSOT 文件是就地改还是改名。
3. `arch.md` 红线 1 的字面范围问题（见下）。

## 路线

1. 新建 `.agents/skills/lib/content-db.mjs`：唯一一处定义
   - `readRepoEnv()` — 读仓库根 `.env`（现有五段解析的公因子）
   - `CONTENT_SCHEMA = 'lemmadeck-schema'` 与 `contentSql({ max })` — 唯一一处定义连接串解析顺序
     （`LEMMADECK_DATABASE_URL || EASYAPP_DATABASE_URL || DATABASE_URL`）和 `search_path`
   - 拿不到 URL 时直接抛错，不静默回落
2. 六个调用点全部改用它，删掉各自的 `.env` 解析与 schema 字面量。
3. 把线上 `lemmadeck-schema` 的真实结构导出成新的 DDL SSOT
   `ssot-schemas/db-schemas/lemmadeck.sql`，删掉过期的 `stemrobin.sql`。
4. 更新 charter 中指向旧文件名的三处（`arch.md` / `dev.md` 的 DDL 说明），并修正 `arch.md`
   红线 1 的范围（下）。
5. 验收：真的保存一篇课文，看它出现在产品里。

## 红线查表（下笔前）

| 条目 | 结论 |
|---|---|
| `arch.md` 1 · 不得在 `app/src/lib/db.ts` 之外开数据库连接 | **字面上会禁掉本工单**，但它的检测子句写的是「连接串出现在 `app/src/routes/` 或任何 `.tsx`」——本意是 app 侧、别让浏览器拿到连接串。内容脚本是 node CLI，从来就自己连库。这是条文范围写宽了，不是本工单要绕的墙：把红线 1 的范围明确限定到 `app/`，并把「内容脚本只能通过 `lib/content-db.mjs` 连库」补成新的一条。人已授权改 charter。 |
| `arch.md` 5 · 禁止往 `stemrobin-schema` 写内容 | 本工单就是来消除它的成因。不冲突。 |
| `arch.md` 2 · 增删改依赖 | 不涉及，`postgres` 已在。 |
| `arch.md` 4 · schema 只能从 SSOT 文件改 | 本工单只让文件描述现实，**不对数据库 apply 任何东西**。 |
| `runbook.md` 1 · 破坏性语句 | 不涉及。 |
| `dev.md` 1 · 提交凭据 | `.env` 不进 git。 |
