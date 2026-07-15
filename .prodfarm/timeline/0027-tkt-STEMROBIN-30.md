# 0027 tkt STEMROBIN-30

- kind: tkt
- ticket: STEMROBIN-30
- type: story
- batch: 0005-progress-and-access
- merge_commit: 53cec43
- seed: STEMROBIN-26
- consumes: []

## Background
需求③④收官：练习按次计分 + 首页真进度条。消费 STEMROBIN-29 的 progress.ts。

## Decision
仅改 app/：① 练习 deck 改为按次 attempt（start→答题→endAttempt→ScoreSummary），结束时算分并经 29 的 `recordPracticeAttempt(lessonId,score)` 记入 `sr_practice_attempts`；② `index.tsx` 用 `getProgress()` 的真进度条取代假进度（completedPoints / 2×课数=32；课文点=走完卡片、练习点=最近一次 attempt ≥80%、可回退）。复用既有 `sr_quiz_attempts`/`attempt_id`（更早单子已加，无 schema drift）。文件：quiz.ts、index.tsx、i18n.ts、app.css、progress.ts(注释) + quiz.test.ts。

## Consequences
- 改 app/ → 已 Azure 重部署 rev 0000029（commit 53cec43）。
- cap9（governor 实测，子代理曾被 API 断线于 AC3）：种 90% attempt→练习完成、首页 "1/32 点"(bar 3.125%)；种更新的 50%→回退 "0/32"（最近一次驱动 + 回退实证）；68 单测、构建净、无 schema drift、测试数据清理；生产站登录后首页真进度条 "0/32 点" 渲染。练习计分 UI(start→end→score) 由 quiz.test.ts 单测 + 子代理 cap6(切断前 AC1/AC2)覆盖。
- 遗留（非阻塞）：`sr_quiz_attempts`(quiz 分组) 与 `sr_practice_attempts`(进度记分) 两表分工，略冗余但清晰；attempt-scoring UI 的端到端点击流我未亲测(单测+子代理覆盖)。

## Proxy decisions
grill cap13 自裁无 leak。核心：复用 29 的记分/进度能力不重造、复用既有 quiz attempt 分组、首页真进度取代假数据。
