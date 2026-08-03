# im-grill — STEMROBIN-120

标准车道：以下问题在开发前必须被裁决（cap13 裁决，人不参与）。

## Q1（阻塞）规格该放在哪一层？新建 `interactions.json`，还是并进 `answer-keys.json`？

**裁决：新建 `interactions.json`，与 `answer-keys.json` 同目录、同 lesson 粒度。**
依据：`answer-keys.json` 的 schema 是 `ld-s10y-answer/lesson-answers@1`，已在产、已入库、已有
gate-2 校验。往里加字段会让同一个 schema 版本承载两种含义，违反 engineering-rules 第 5 条
「一个契约一个真源」。独立文件让两者可以各自演进，也让「每题恰一条规格」这条不变量能被独立校验。

## Q2（阻塞）widget 词汇表取多大？

**裁决：v1 只收六个：`number` / `math` / `grid-point` / `choice-one` / `choice-many` / `free`，
且只有前三个允许机械推导，后三个只能被标记为待补。**
依据：engineering-rules 第 2 条「最小实现，不做投机」。产品端本工单不消费 `choice-*`
（那是 STEMROBIN-121 之后的事），现在就定死它们的选项形状等于凭空猜。标记为待补并写明原因，
比造一个没人用的结构诚实。

## Q3（阻塞）推导不出来的题怎么办？允许兜底成 `math` 吗？

**裁决：允许，但必须显式记录 `derivation` 与 `needsAuthoring`，不允许静默兜底。**
依据：engineering-rules 第 5 条「真源缺失就快速失败并暴露出来，绝不用兜底掩盖不可能状态」。
`math` 是当前产品的实际行为，所以它不是「掩盖」，是「维持现状」；但必须让人一眼看出哪些题
只是维持现状、原因是什么，否则下一轮无从下手。

## Q4（阻塞）交叉校验用什么做判据？校验不过是警告还是失败？

**裁决：`grid-point` 的判据是「从 FigureSpec 复原出的每个具名点坐标，都必须出现在该题答案键的
expected 值里，且小问数 = 2 × 具名点数」；不过即失败，拒绝产出。**
依据：工单验收标准第 3 条明确要求「改成与答案键矛盾的值后流程报错并拒绝产出」，且
ld-s10y-lesson 全线的信条是「每一步都有可机器校验的门禁，不允许静默降级」。

## Q5（非阻塞）入库放哪一列？要不要改表？

**裁决：并进 `sr_lessons.exercises` 里每道题的对象，与 `answerKey` 同级，不改表结构。**
依据：工单 Constraints 明写「数据库表结构保持不变」；`exercises` 本就是 jsonb，
`answerKey` 已经是同样的并入方式，沿用它就是「一个操作一条规范路径」。
