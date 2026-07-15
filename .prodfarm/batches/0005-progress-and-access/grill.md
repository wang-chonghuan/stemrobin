# Batch 0005-progress-and-access — grill 归档

来源：**released cap8 seed STEMROBIN-26**。人在本会话就 seed 级问题被 grill 并**亲自裁决**（不同于 0004 的机器自裁），其裁决 + 机器默认即本 batch 的 grill 记录。

## Release gate 裁决
- 模式：`full delegation`；结果：**已放行**，草案集（5 张）整体立批。

## 人裁决的 seed 级问题
- **G-练习完成**：练习进度 = **最近一次 attempt 分数 ≥80%**（可回退）；每用户每课只存最近两次 attempt；提交一次即计分。
- **G-课文完成**：**走完全部卡片**（read-check 全通过，软门禁允许重读重答）即完成；从作答事件派生。
- **G-进度跨语言合一**：按课算、与语言无关；**总点 = 2 × 现有课数**。
- **G-账号/门禁**：**全站需登录**、**不开放注册**、仅现有账号（沿用 charter 无账号创建）。

## 机器默认（人未反对）
- **G-全文速览**：课程页"逐卡精读 ↔ 全文速览"切换，随时可用、无 read-check、不计进度；连续渲染 JSONB 内容（PDF 同源），不嵌 PDF。
- **G-公式 bug**：修 read-check 的 KaTeX typeset 路径（题干/选项公式显示成原始 LaTeX 源码）；顺带抽查 STEMROBIN-25 自动转换 read-check 的正确性。

## Feasibility 探针（已知）
- 课文完成可从 `sr_content_answer_events`(kind=read_check) 派生，无需新表。
- 练习"最近两次 attempt/分数"需新存储（新表，每用户每课留 2 条）。
- read-check KaTeX：`card-reader.tsx` 有 `renderMath(checksRef.current)` typeset 逻辑但生产未生效（疑似 STEMROBIN-25 转换后选项含大量公式暴露 typeset 时机/ref 覆盖问题）。
- 全站登录门禁：现内容页公开、仅记录需登录；需加服务端路由级 auth gate。
- 数据授权：答题事件可弃、`sr_users` 不可动。
