# 0073 tkt STEMROBIN-120

- kind: tkt
- batch: 0016-practice-input
- ticket: STEMROBIN-120
- type: enabler
- lane: standard（新增 `lesson-interactions@1` 契约，违反 express 谓词 2）
- merge: PR #35 → main e3319e9
- deploy: ca-stemrobin 已更新（本工单不改 app 代码；交付物在内容库与技能里）

## What shipped

`ld-s10y-answer` 新增 cap3：为每道 exercise 产出一条交互规格，声明「这道题怎么答」。
这是管线里此前完全缺失的一层——产品端把所有作答框渲染成公式编辑器，是 app 的兜底，
不是管线的决定，因为管线从来没被问过这个问题。

规格独立成 `interactions.json`（与答案键同目录同粒度），入库并进
`sr_lessons.exercises[].interaction`，与 `answerKey` 同级，**不改表结构**。
只带作答形态与参数，不带 `expected` 与 `displayAnswer`——判分仍只在服务端做。

## Evidence

三课 65 道题各得一条规格：`number` 39、`math` 12、`free` 11、`grid-point` 3。
发布前后对 `content` / `answerKey` / `html` / `figures` 做 sha256 比对，四项逐字未变。
篡改第 262 题的具名点后 finalize 报错并 exit 1。浏览器打开三课两个 tab，正文块数、题数、
插图数与执行前一致，控制台无错误。判据用例 8/8。

## Decisions（cap13 在 im-grill.md 中裁决，人未参与）

- Q1 规格独立成文件而不是并进答案键：一个 schema 版本不承载两种含义（SSOT）。
- Q2 v1 词汇表六个，只有 `number`/`math`/`grid-point`/`free` 允许机械推导；`choice-*` 只能
  标记待补——产品端还没消费它们，现在定死选项形状等于凭空猜。
- Q3 推导不出的题落到 `math`（维持现状），但必须写 `derivation` 与 `needsAuthoring`，
  不允许静默兜底。
- Q4 `grid-point` 的判据是拿答案键交叉校验，不过即失败拒绝产出。
- Q5 并入 jsonb，不改表结构。

## 这次抓到的东西

FigureSpec 是**渲染**规格不是**几何**规格：网格是 21 条独立线段，刻度是散落的文字，没有一处
声明过原点和单位。所以坐标系只能反推，而反推出来的东西只算假说——判据在答案键那边：
每个复原出的具名点坐标必须出现在该题 `expected` 里，且小问数 = 2 × 具名点数。

这条校验顺带抓出一个此前无人能发现的图缺陷：`fig-67` 的 y 轴刻度 7 画在 464，等距应为 474。
FigureSpec 现有的 `assertions` 只有 `objectCount`（数点、数线段、数文字），没有任何几何断言，
所以这类错画不出现在任何门禁里。已记为该规格的 `frameWarnings`。

## Deferred

- 给 `ld-s10y-image/figure-spec@1` 增加 `frame` 声明块与刻度等距断言，让坐标系是**声明**的
  而不是**反推**的，并让这类缺陷在渲染阶段就被拦下。
- 修 `fig-67` 的 y 轴刻度 7。
- `choice-one` / `choice-many` 的选项形状与产出。
