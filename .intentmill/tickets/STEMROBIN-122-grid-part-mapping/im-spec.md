# im-spec — STEMROBIN-122 交互规格声明小问与格点的对应

## Intent

`grid-point` 的交叉校验只验成员关系与数量，不验顺序。规格没有声明第几个小问对应哪个点的
哪条轴，答案键与图之间的对应关系是观察出来的，不是被校验保证的。消费方只能假设
「第 2i 个小问是第 i 个点的横坐标」——而消灭这类假设正是规格这一层存在的理由。

## Scope

规格显式声明每个小问对应哪个具名点的哪条轴；交叉校验从成员关系升级为有序对应；顺序对不上
即失败、拒绝产出。

## Requirements

1. 三课重新产出与校验全部通过，每条 `grid-point` 规格能逐个小问说出它对应哪个点的哪条轴。
2. 互换任意一条 `grid-point` 规格里两个小问的对应关系后校验必须失败；且这种互换在旧的
   成员关系校验下是发现不了的。
3. 内容库中三课全部答案键、题面与插图在本次执行前后逐字一致。

## Confirmed Decisions

- 映射写进规格的 `parts` 数组，逐项 `{point, axis, label?, unit?}`，顺序即小问顺序。

## Non-Scope

- 不得引入任何新依赖；不得改动课程内容、题面、插图与答案键；不得为三课以外的课产出规格；
  表结构不变。

## Critical Existing Contracts

- `lesson-interactions@1` 已入库并被 `sr_lessons.exercises[].interaction` 承载；本次是在同一
  版本内新增一个字段，既有字段语义不变。
- 发布器逐题保留 `answerKey`、题面与图。

## Compatibility And Regression Constraints

- 非 `grid-point` 的规格产物必须与本次改动前逐字一致。

## Open Questions

None.
