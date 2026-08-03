# 0074 tkt STEMROBIN-122

- kind: tkt
- batch: 0016-practice-input
- ticket: STEMROBIN-122
- type: fix
- lane: standard（在 `lesson-interactions@1` 内新增字段，express 谓词 2 不成立）
- merge: PR #36 → main
- deploy: ca-stemrobin 已更新（本工单不改 app 代码）

## What shipped

`grid-point` 的交叉校验原先只验成员关系与数量，不验顺序。规格因此没说清「第几个小问对应
哪个点的哪条轴」，消费方只能自己假设「第 2i 个小问是第 i 个点的横坐标」。第 262、265 题
确实是这个顺序，但那是观察到的巧合而不是保证 —— 把这条假设留在规格之外，正是引入规格
这一层要消灭的东西。

改成按具名点顺序逐个小问走，并把对应关系写进规格的 `parts`
（`{point, axis, label?, unit?}`），校验器把它也纳入独立重算的比对项。

## Evidence

三条 `grid-point` 规格各带一份逐小问映射，且映射出的 point/axis 与答案键里的人写标签
（`M 向右` / `M 向上` / `K 向右` …）逐条吻合 —— 这是对顺序假设的一次独立印证。

两个方向的篡改都被拦下：互换规格里两个小问的对应关系 → 失败 exit 1；互换答案键里两个
小问的 expected（集合一个值没变，只有顺序错）→ 同样失败 exit 1。后者正是旧校验发现不了
的那一种。判据用例 9/9。库中 content/answerKey/html/figures 的 sha256 与本批开工前逐字一致。

## Decisions

- 这张单是批内自建的 fix，起因是开发 STEMROBIN-121 前发现它缺这个前置。按「在飞工单不得
  扩张范围」，它既没有塞进 121，也没有去改已冻结的 120。
