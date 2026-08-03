# 0069 batch 0016-practice-input

- kind: batch
- batch: 0016-practice-input
- seed: STEMROBIN-116
- charter_commit: none

## Decisions and rationale

Seed STEMROBIN-116（人类意图，原文保留在工单里）：练习「难以答题，学生必须用数学键盘仔细打字才行」，不利于获客和留存；交互规格归 ld-s10y-answer 的 cap3；app 默认语言改中文；范围限已上线三课，不重新生成课程内容，主要改技能。

立批前的调查全部是实测。用 Playwright 驱动本地 3200，以 HMAC 会话 cookie 登入，逐课打开、逐题提交，并直接查询内容库统计：三课共 **65 道题、186 个作答部件**，其中 **160 个（86%）的标准答案就是一个普通数字**，17 个是文本精确匹配，**需要代数表达式的部件为 0 个**。也就是说线上产品里没有任何一个作答部件需要 LaTeX 数学键盘，而 100% 的作答框都强制使用它——这是本批的立批依据。

另外实测确认三处：第 1 课的 26 个作答部件在答案键里用 `id` 而非 `ld-s10y-answer` 文档规定的 `label`，导致作答框一律显示「我的答案」（数据漂移违反了技能自己的契约，不是新需求）；提交一次后作答框即锁死并展开标准答案，答错没有第二次机会；`DEFAULT_LOCALE` 为 `'en'`（STEMROBIN-111 所设），而全部课程内容是中文。

技术路线上确认**不需要新增依赖**（宪章 · 无谓依赖为铁律）：数字输入用原生 input，坐标网格点选用已有的内联 SVG 与 React 事件。**也不需要改表结构**：交互规格并入 `sr_lessons.exercises` 的每道题对象，与 `answerKey` 同级，沿用 ld-s10y-answer 既有的发布路径。

自我 grill 的主要产出是一条约束驳回：人要求「必须用 express 模式」，但按 ticket-contract 的六条准入谓词，120（新增 `lesson-interactions@1` 契约）违反谓词 2，121（本地不存在的 UI 形态）违反谓词 3。非对称规则规定任何人都不能在谓词不成立时设 express，故二者按 standard 归档。此项由规则本身裁定，不需要人裁决，不构成 grill 泄漏。

草案集从人给的 10 张额度收敛到 5 张：每张工单都要走 worktree、验收、合并、重部署，跑不完的风险高于价值，余额留给批内自建的 fix。

## Deferred

- 第 1 课图形归类控件（6 小问共用 1 个作答框且不判分）——最重的交互形态，需单独一张 story。
- 错题本条目只显示「Book 5m / Exercise 5」，无课名与题面。
- 上一课/下一课按大纲走，从三课任一课点「下一课」会落到无内容的空卡。
- 课文页底部 Save 与 Ask AI 是没有 onClick 的死按钮。
- 第 1 课图注渲染成「图 1图 2」合并一行；图自身的 label 从不显示。
- FigureSpec 只有 objectCount 断言，无几何断言；实测 fig-67 的 y 轴刻度 7 破坏了 55px 等距（应在 474，实际 464）。

## Veto handling

none

## Charter changes

none

## Notes

- charter/architecture.md 与 charter/runbook.md 已与实际漂移：内容库早已从 Azure easy-app 的 `stemrobin-schema` 迁到 Supabase 的 `lemmadeck-schema`（`LEMMADECK_DATABASE_URL`，见 `app/src/lib/db.ts`），且 `sr-math-lesson` 已被 `ld-s10y-lesson` / `ld-s10y-answer` 取代。宪章在批内冻结，此处仅登记为边界笔记，不在本批修改。
- `.evodocs/modules/` 的内容仍描述已被取代的 card-tree + locale overlay 模型（`app/src/lib/lessons.ts` 的注释明确说明该模型已废弃），本批的立单据以代码与实测为准。
