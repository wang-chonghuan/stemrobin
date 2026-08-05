# STEMROBIN-124 · grill（self，人于 cap3 起手时授权）

## Q1 · 共用模块放哪、叫什么？

**候选**：(a) `.agents/skills/lib/content-db.mjs`；(b) 放进 `sr-voa1500/scripts/vocab.mjs`（已被两个
脚本 import）；(c) 各脚本仍自己连、只共用一个常量文件。

**裁决：(a)**。(b) 会让 `sr-story` 去 import 一个英语课程词表模块，是错误的依赖方向。(c) 留下了
「各自 `postgres()`、各自传 schema」的形状，下次改库照样漏 —— 工单的约束明写了「只允许有一处定义」，
必须连**建连接**本身也收进去，而不只是收一个字符串常量。`.agents/skills/` 本来就是承载两个技能公共
依赖的包，`lib/` 是它自然的位置。

## Q2 · DDL SSOT 就地改，还是改名？

**裁决：改名为 `ssot-schemas/db-schemas/lemmadeck.sql`，删掉 `stemrobin.sql`。** 文件名是读者判断
它描述哪个 schema 的第一个线索，留着 `stemrobin.sql` 描述 `lemmadeck-schema` 正是这次事故的同一
种错位。代价是 charter 三处引用要跟着改 —— 一次性的，且本来就要改。

## Q3 · DDL 手写还是从线上导出？

**裁决：从 `information_schema` 生成，人不逐字手抄。** 手抄 18 张表必然抄错，而抄错的 SSOT 比没有
SSOT 更坏。生成脚本留在工单 `tmp/` 里（不入库），产物 `lemmadeck.sql` 入库。AC4 的对拍脚本与生成
脚本各写各的读法，不共用代码，否则是自己跟自己对拍。

## Q4 · `arch.md` 红线 1 字面上禁掉了本工单，怎么办？

**裁决：改红线，不绕红线。** 原文「不得在 `app/src/lib/db.ts` 之外开数据库连接」是我两天前从
`.prodfarm` 的 engineering-rules「DB access is server-only」翻写的，那条的本意是**浏览器不许拿到
连接串**，检测子句写的也是 `app/src/routes/` 和 `.tsx`。内容脚本是仓库里一直存在的 node CLI，从来
自己连库，条文范围写宽了。

处置：红线 1 的范围限定到 `app/`；另加一条「内容脚本连库只能经 `.agents/skills/lib/content-db.mjs`」
—— 这条是可查表的（脚本里出现 `postgres(` 就是越线），恰好把本工单建立的秩序钉住。人已授权改 charter。

## Q5 · 旧库 `stemrobin-schema` 里的历史数据要不要迁？

**裁决：不迁，且本工单不碰。** 工单约束已明写。单元 01 两边都有；单元 02 由 STEMROBIN-123 重跑
`save-lesson.mjs` 生成到新库，那是它自己的活。旧库留着不动，等人决定何时清理。

## Q6 · 只有人能定的问题？

有一个，但**不阻塞本工单**：旧库 `stemrobin-schema` 何时下线、里面的历史数据要不要留档。记进
handoff 的 Residual，不在这里替人决定。
