# im-spec — STEMROBIN-120 ld-s10y-answer 增加交互规格能力

## Intent

从扫描件到产品，全程没有任何一处描述过「这道题怎么答」。产品端把所有作答框一律渲染成公式
编辑器，是 app 的兜底，不是管线的决定。这一层缺失就是练习难以作答的根因。

## Scope

为 ld-s10y-answer 增加 cap3：为一个现代版 lesson 的每一道 exercise 产出一份交互规格，声明这道题
的作答形态及其参数，并随课程一起写入内容库。规格与答案键逐题一一对应。能机械推导的必须机械
推导；推导结果必须能与已有答案键交叉校验，校验不过即失败。为三课各产出一份并入库。

## Requirements

1. 对三课执行产出与校验流程，各得到一份通过校验的交互规格，且每一道题恰有一条规格。
2. 内容库中三课的每一道题都带有交互规格，且全部答案键内容与执行前逐字一致。
3. 把任意一条规格改成与该题答案键矛盾的值后重新校验，流程报错并拒绝产出。
4. 三课的课文、题面与插图在产品中的呈现与执行前一致。

## Confirmed Decisions

- 规格独立成 `interactions.json`，与 `answer-keys.json` 同目录同粒度（Q1）。
- v1 widget 词汇表六个，仅 `number`/`math`/`grid-point` 允许机械推导（Q2）。
- 推导不出的题维持 `math`，但必须记录 `derivation` 与 `needsAuthoring`，不得静默（Q3）。
- `grid-point` 的交叉校验判据见 Q4；不过即失败。
- 并入 `sr_lessons.exercises[].interaction`，不改表结构（Q5）。

## Non-Scope

- 不得引入任何新依赖。
- 不得重跑三课的装订、改编与离线渲染流程。
- 不得为这三课以外的任何课产出规格。
- 不得覆盖或丢失任何已有答案键。

## Critical Existing Contracts

- `answer-keys.json` = `ld-s10y-answer/lesson-answers@1`，每题恰一条 answer；`parts[]` 里小问名
  有 `label`（文档规定）与更早的 `id` 两种写法。
- FigureSpec = `ld-s10y-image/figure-spec@1`，`objects[]` 是画布像素坐标下的扁平图元
  （`segment`/`point`/`text`），没有语义坐标系；`assertions` 目前只有 `objectCount`。
- 发布器只读 `editions/<edition>/lessons/`，要求 adaptation audit 为 pass，且重发时必须保留
  同题号已有的 `answerKey`。
- 内容库连接串取仓库根 `.env` 的 `LEMMADECK_DATABASE_URL`，schema `lemmadeck-schema`。

## Compatibility And Regression Constraints

- 已入库的 `content`（课文）与 `exercises[].html`（题面）与插图必须逐字不变。
- 未产出规格的课（本仓库当前没有别的课）不受影响。

## Open Questions

None.（Q1–Q5 已由 cap13 裁决，见 im-grill.md）
