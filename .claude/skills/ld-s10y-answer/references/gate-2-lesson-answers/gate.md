# Gate 2 — lesson 答案生产

目标：指定 lesson 的每个 exercise 都有孩子提交后可看到的正确标准答案，并且自动判题
不会对不适合的题伪造正误。

逐题检查：

1. exercise 与题面、插图、书后答案属于同一题号。
2. 有 `bookRaw` 时已实际验算；原书答案不是未经检查直接复制。
3. 没有书后答案时已完整求解，`source` 为 `derived`。
4. 多小问和多个待求量已拆成独立 `parts`，标签和单位清楚。
5. `expected` 是学生实际可输入的答案，不含只用于展示的解释文字。
6. `displayAnswer` 足以让学生理解标准答案；作图和证明题要写关键作法或理由。
7. 只有能由 `exact`、`numeric` 或 `expression` 可靠判定的题才标 `auto`。
8. 作图、证明、依赖图形位置的开放回答标 `ungraded`，没有因为“需要全覆盖”而硬判正误。
9. 全 lesson 无漏题、重题，书后答案来源和模型推导来源没有混淆。

Gate 失败时修正 `answer-keys.json` 后重跑；通过后执行 `lesson_answers.py finalize` 和
真实 `publish.mjs`。
