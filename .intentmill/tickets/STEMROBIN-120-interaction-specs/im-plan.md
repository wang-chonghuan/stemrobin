# im-plan — STEMROBIN-120

来源契约：`im-spec.md`；开放问题已由 cap13 在 `im-grill.md` 中裁决。

## 实现思路

新增 `tools/lesson_interactions.py`（prepare/finalize）与 `tools/publish-interactions.mjs`。
推导判据全部是答案键的函数，没有一处需要读题面文字。唯一需要「从图里读语义」的是
`grid-point`，它从 FigureSpec 的图元反推坐标系与具名点 —— 但反推出来的东西只算假说，
判据是拿答案键的 expected 做交叉校验，对不上就不产出。

## Phases

1. 推导器：widget 词汇表、五条判据、`derivation`/`needsAuthoring` 记录。
2. 坐标系复原：中位数稳健拟合 + 具名点识别 + 与答案键的交叉校验 + `frameWarnings`。
3. 校验器 finalize：每题恰一条、schema、widget 合法、grid-point 独立重算比对。
4. 发布器：并入 `exercises[].interaction`，逐题保留 `answerKey`，不改表结构。
5. 文档：SKILL.md 增加 cap3 一节。

## Unit Test Plan

- 判据级用例（`tests/test_lesson_interactions.py`）：标签双写法、纯数字判定、刻度拟合
  忽略 0 标签并报告偏离刻度、非 deterministic 图拒绝、五条路由、带单位的 expected 不算数。
- 端到端：对三课 prepare + finalize；篡改一条规格后 finalize 必须失败；发布前后对
  content / answerKey / html / figures 做 sha256 比对；浏览器打开三课两个 tab 核对渲染。

## Handoff Expectations

三课各一份 status=ready 的规格并已入库；判据用例全绿；篡改用例确实失败。不合并、不部署。
