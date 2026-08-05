# STEMROBIN-124 · handoff

## What changed

- **新增 `.agents/skills/lib/content-db.mjs`** —— 内容库的唯一定义处：`readRepoEnv()`、
  `CONTENT_SCHEMA = 'lemmadeck-schema'`、`contentUrl()`（解析顺序与 `app/src/lib/db.ts` 一致：
  `LEMMADECK_DATABASE_URL || EASYAPP_DATABASE_URL || DATABASE_URL`）、`contentSql({ max })`。
  拿不到 URL 直接抛错，不静默回落。
- **六个调用点改用它**（工单说 5 个脚本，实际是 6 处连接 —— `save-lesson.mjs` 有探测连接和主事务
  两个）：`sr-voa1500` 的 `save-lesson.mjs` ×2、`coverage.mjs`、`reconcile.mjs`、
  `practice-audio.mjs`，`sr-story` 的 `save-story.mjs`。每处删掉了自己的 `.env` 手工解析、自己的
  URL 选择和自己的 `search_path` 字面量。
- **DDL SSOT 换代**：删除 `ssot-schemas/db-schemas/stemrobin.sql`（描述已退役的 schema，落后 7 张
  表），新增 **`ssot-schemas/db-schemas/lemmadeck.sql`** —— 18 张表 + 17 个附加索引，由脚本从线上
  `information_schema` 生成，不手抄。文件头写明它是「描述」不是迁移，永不对库 apply。
- **sr-story 两篇文档**（`story-contract.md`、`persist.md`）改为指向新库、新 SSOT 文件，并写明
  「不要自己开连接」。
- **charter**：`arch.md` 红线 1 的范围收到 `app/` 之内（原文字面上会禁掉内容脚本连库，而它的检测
  子句本就写的是 `app/src/routes/` 和 `.tsx`）；新增红线 6「内容脚本不得直接调 `postgres(`」——
  可 grep 查表，把本工单建立的秩序钉住；Key decisions、Tools、`dev.md` 的 DDL 说明、`devops.md`
  的部署红线 3 一并改指新文件名。

## AC results

| | 结果 | 观察到什么 |
|---|---|---|
| AC1 保存后立刻出现在产品里 | **通过** | 用改后的 `save-lesson.mjs` 存 `english-u02-08`，侧栏「技术英语」从 7 变 8、第 8 条是 *Crossing the Road*；课文页正常渲染九句对话（Ben/Ana 分说话人）、句型框、逐句音频，不再显示「课文暂不可用」。中文默认收在「整篇中文对照」开关里，点开后「别走到马路上去」出现 —— 第一次断言写成了默认可见，是断言写错，不是产品问题。截图 `tmp/ac1-catalog.png`、`tmp/ac1-lesson.png`。 |
| AC2 `coverage.mjs` 与目录篇数一致 | **通过** | `coverage.mjs` 课文数 = 8，浏览器侧栏数到 8。 |
| AC3 仓库无写向旧 schema 的路径 | **通过** | `grep -rn stemrobin-schema` 只剩两处散文（`content-db.mjs` 注释、`lemmadeck.sql` 文件头），都在说明它已退役；无可执行引用。 |
| AC4 DDL 与线上一致 | **通过** | `tmp/ac4-ddl-match.mjs` 用正则从 SQL 文本解析、与 `information_schema` 对拍（刻意不复用生成脚本的代码）：18 表 vs 18 表，每张表列集合完全相同，退出码 0。 |

机械防线 `cd app && npm run test && npm run build`：75 个测试全过（11 个文件），构建通过。

## Deviations from plan.md

- 计划里说「五个脚本」，实际改了 **六处连接**：`save-lesson.mjs` 里除主事务外还有一个探测
  `sr_word_audio` 的连接。计划是照工单写的，读代码时才发现。
- DDL 生成顺带把 17 个非主键索引也导了出来 —— 计划只说了表和列。留着更有用，且 AC4 只对拍表/列，
  索引不参与判定。

## Environment

- 用的端口：**52124**（`project.json` 算出的即是，未被占用）。
- 没有新增、修改或删除任何环境变量。`LEMMADECK_DATABASE_URL` 本来就在 `.env` 和容器里。

## Residual

- **旧库 `stemrobin-schema` 仍然存在且仍可写**，里面躺着 STEMROBIN-123 第一次误写进去的单元 02
  七课，以及单元 01 的历史副本。何时下线、要不要留档，是人的决定，本工单不碰。
- `save-lesson.mjs` 保存时会把「未分配」的目标词直接**收养**为 `taught`。这让词表能自愈，但也意味着
  忘记预先分配不会报错。是否要在没有计划时给出警告，值得单开一个工单。
- `app/src/lib/db.ts` 的 fallback 链（`|| EASYAPP_DATABASE_URL || DATABASE_URL`）现在只对未迁移的
  环境有意义。等确认没有这样的环境后可以删掉，届时 `content-db.mjs` 同步简化。
