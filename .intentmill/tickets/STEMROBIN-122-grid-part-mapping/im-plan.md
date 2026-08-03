# im-plan — STEMROBIN-122

来源契约：`im-spec.md`。

## 实现思路

`try_grid_point` 原先把 expected 汇成一个集合做成员检查。改成按具名点顺序逐个小问走：
第 2i 个小问必须对应第 i 个点的 x、第 2i+1 个对应 y，且该小问的 expected 就是那个坐标。
走通的同时把对应关系记成 `parts`。校验器把 `parts` 也纳入独立重算的比对项。

## Phases

1. 推导：有序对应 + 产出 `parts` 映射。
2. 校验：`parts` 纳入重算比对。
3. 三课重新 prepare/finalize/publish；文档同步。

## Unit Test Plan

- 判据级：正常顺序产出正确映射；把两个小问的 expected 互换后必须返回 None（这正是旧校验
  发现不了的那种错）。
- 端到端：三课 finalize 通过；互换规格里两个小问的对应关系后 finalize 失败；互换答案键里
  两个小问的 expected 后 finalize 失败；发布前后 content/answerKey/html/figures 的 sha256
  与本批开工前一致。

## Handoff Expectations

判据用例全绿、两个方向的篡改都被拦下、三课已重新入库。不合并、不部署。
