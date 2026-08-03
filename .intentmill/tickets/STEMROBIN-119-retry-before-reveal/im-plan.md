# im-plan — STEMROBIN-119

来源契约：`im-spec.md`（express 转写）。

## 实现思路

组件原本用「有没有判分结果」这一个布尔量同时表达三件事：要不要锁作答框、要不要收起提交按钮、
要不要展开标准答案。把它拆成两个：`graded`（这次提交有结果）与 `finished`（这道题结束了）。
只有答对、自评完成、或答错满两次才算结束；第一次答错是 `graded && !finished`，此时作答框保持
可编辑、提交按钮改称「再试一次」、标准答案位置换成一句提示。判分与记录链路完全不动。

## Phases

1. 拆分状态并按 `finished` 控制锁定与按钮；答错计数随题目切换归零。
2. 第一次答错时以提示替代标准答案；补两条文案与提示样式。

## Unit Test Plan

Express 的测试义务是一份工单级 Playwright 脚本，断言与验收标准 1:1：
- AC1 → 第 13 课某数字题填错提交：提示答错、无标准答案、作答框仍可编辑；改对再提交判对。
- AC2 → 另一道题连续两次填错：第二次后标准答案展开且提交按钮消失。
脚本：`app/tests/tickets/STEMROBIN-119-retry-before-reveal.spec.ts`，带截图。

## Handoff Expectations

worktree 内 `npm run test` 绿、`tsc --noEmit` 干净、Playwright 全过、截图留存。不合并、不部署。
