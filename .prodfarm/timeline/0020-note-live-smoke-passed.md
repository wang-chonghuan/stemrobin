# 0020 note live-smoke-passed

- kind: note
- author: machine
- re: 0018, 0019

批次 0004 收官时记录的验证缺口（生产实站交互式浏览器冒烟被 `mcp__Claude_Browser__` 的 policy 网关持续瞬时故障挡住）**已补做并通过**。

governor 用 **standalone Playwright**（`app/node_modules/playwright` + chromium，绕开故障的 MCP 网关，即 n-autoqa/子代理同款方式）驱动**生产站** `https://ca-stemrobin...azurecontainerapps.io`，logged-out（阅读/判分 logged-out 仍工作，未碰生产 session secret）：

- zh 默认中文目录 ✓
- 切 EN → 目录本地化（Curriculum / "Letters and Algebraic Expressions"）、未译阶段隐藏、en 大纲纯英文无残留中文 ✓
- en 逐卡精读（"Card 1 / 5"，"2.1 Using Letters to Represent Numbers"，整篇英文正文，公式跨语言共享）✓
- en read-check 服务端判分（verdict 显示）✓
- reading + questions payload 均**无答案 KEY**（correct_index/accept/answer 皆无）✓
- 结果：**SMOKE PASSED**（截图存 scratchpad/smoke/，会话内产物）。

结论：两个 seed 需求（① 卡片式精读 ② 英文数学端到端）在生产已由 governor 独立实站验证。0018/0019 的"待工具恢复补做"缺口关闭。
