# im-plan — STEMROBIN-121

来源契约：`im-spec.md`；开放问题已由 cap13 在 `im-grill.md` 中裁决。

## 实现思路

点一下格子 = 一次性填好两个数。所以不新增判分路径：网格组件把点击换算成格点坐标，写进
规格声明的那两个小问，剩下的走既有的提交与判分链路。投影层只下发网格范围、点名和小问映射，
坐标一个不带。

cap3 增加 `grid-plot`：目标坐标印在题面里的那一类，从题面正则提取并与答案键有序交叉校验。
答案键侧新增一个转写工具，把这类题的题面坐标展开成 numeric 小问。

## Phases

1. cap3：`grid-plot` 推导 + 两种网格形态都带上 `domain`；校验器纳入 grid-plot 重算。
2. 答案键转写工具，处理第 264、267 题。
3. 投影层下发安全子集；判分结果逐小问回传 `standard`。
4. `GridAnswerField` 组件与样式；接进作答组件与课页。

## Unit Test Plan

工单级 Playwright：
- AC1 → 第 264 题按八个目标坐标逐点点选后提交，得到「回答正确」。
- AC2 → 第 265 题故意点错 A，两轮提交；第一轮不出现标准位置与文字答案，第二轮网格上
  同时出现所点位置与四个标准位置，并有图例。
另跑 skill 判据用例与 app 单测。

## Handoff Expectations

worktree 内 `tsc --noEmit` 干净、vitest 75/75、skill 判据 9/9、Playwright 2/2。不合并、不部署。
