# im-plan — STEMROBIN-118

来源契约：`im-spec.md`（express 转写）。

## 实现思路

作答框的形态本来就由答案键决定，只是这个信息没有投影到浏览器。在服务端投影里给每个小问补两样：
一是把 `label` 与旧的 `id` 归一成同一个标签，二是给出输入形态（`numeric` 判定 → 数字，其余 → 数学）。
组件按形态选渲染分支：数字分支是原生 `input`（`inputMode="decimal"` 唤起系统数字键盘）加一个正负号
切换按钮（数字键盘没有减号，而绝对值与坐标两课都有负数答案）；其余仍走 MathLive。两个分支共用同一
个标签行、同一套 localStorage 键与同一个提交路径，所以判分链路一个字都不用改。

## Phases

1. 服务端投影补标签归一与输入形态。
2. 组件按形态分流，新增数字输入分支与样式；占位文案统一走 i18n。

## Unit Test Plan

Express 的测试义务是一份工单级 Playwright 脚本，断言与验收标准 1:1：
- AC1 → 390px 视口，第 13 课数字题：作答框是 `inputmode=decimal` 的原生输入且 MathLive 虚拟键盘
  未出现；填正确答案判对、填错误答案判错。
- AC2 → 第 1 课第 2 题三个作答框标签为 1/2/3；第 16 课第 262 题八个作答框标签为 M/K/P/N 的
  向右向上，且显示单位「格」。
脚本：`app/tests/tickets/STEMROBIN-118-numeric-input.spec.ts`，带截图。

## Handoff Expectations

worktree 内 `npm run test` 绿、`tsc --noEmit` 干净、Playwright 脚本全过、截图留存。不合并、不部署。
