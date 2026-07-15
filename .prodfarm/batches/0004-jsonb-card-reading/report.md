# Batch 0004-jsonb-card-reading — 收官报告

Seed：STEMROBIN-18（full delegation）· 1 seed = 1 batch · 结局：**done**（6/6 交付，无 abort）。

## 交付概要

一次完整**内容管线重建 + 迁移 + 两个学习者功能 + 英文数学**，全部经 cap9 独立验收后合并 main：

| 单 | 类型 | 交付 | PR / merge | 部署 |
|---|---|---|---|---|
| STEMROBIN-19 | enabler | JSONB 内容 SSOT schema（content/exercises/ledger/i18n 覆盖/事件表；KEY 结构隔离） | [#7](https://github.com/wang-chonghuan/stemrobin/pull/7) `d8f5499` | schema-only，无需重部署 |
| STEMROBIN-20 | enabler | 生成器 `sr-math-lesson` 重建为 JSONB-first（读 DB ledger、写 JSONB、从 JSONB 渲 HTML/PDF、生成 read-check） | [#8](https://github.com/wang-chonghuan/stemrobin/pull/8) `aac944b` | skill-only |
| STEMROBIN-21 | enabler | 16 篇真实课 + ledger 迁入 JSONB SSOT（课文逐字节未变，practice 区排除，1:1 exercises，130 read-checks） | [#9](https://github.com/wang-chonghuan/stemrobin/pull/9) `37f0efa` | skill+DB 数据，无需重部署 |
| STEMROBIN-22 | story | 数学课**逐卡精读软门禁**（一次一卡、read-check 服务端判分、答错回读、读完进练习）zh | [#11](https://github.com/wang-chonghuan/stemrobin/pull/11) `6655952` | **Azure 重部署** rev 0000023 |
| STEMROBIN-23 | enabler | 英文译文覆盖层生成流程 + 16 篇 en 覆盖层（只译散文，公式/SVG/KEY 中立） | [#10](https://github.com/wang-chonghuan/stemrobin/pull/10) `a661150` | skill+DB 数据 |
| STEMROBIN-24 | story | **语言切换（中/EN）+ 英文数学端到端**（目录/精读/read-check/练习全英文，按 locale 可用性，zh 不变） | [#12](https://github.com/wang-chonghuan/stemrobin/pull/12) `e772699` | **Azure 重部署** rev 0000024 |

**最终线上**：`ca-stemrobin` revision 0000024（commit e772699）Healthy/Running。两个 seed 需求（① 卡片式精读 ② 英文版数学）均已上线。

## 核心成果（对照 seed 意图）
- **卡片式精读**：课文不变、按语义分卡带编号、逐卡 read-check 软门禁防跳读、读完才进练习。
- **英文数学**：多语言写进 goal；内容 SSOT = DB JSONB；生成器 JSONB-first；16 课 zh→en 覆盖层；app 中/EN 切换端到端；公式跨语言共享标准记法。
- **干净无妥协**：卡片/ledger/练习全入 DB JSONB 单一权威，本地 ledger 文件退场；i18n 结构中立+覆盖层分离，答案 KEY 结构性隔离。
- **数据边界守住**：`sr_users`（2 行含测试账号）全程未动；答题事件按授权可弃；16 课课文迁移逐字节保真（每课 diff+快照可审计）。

## Proxy decisions（人可事后否决的机器自裁清单）
所有 grill 均由 cap13 等价自裁（full delegation，无 human），无 grill-leak。逐单基据见各 tkt timeline 的 Proxy decisions 段：
- 0014 (19)：BD1 zh 作覆盖层一行；BD2 加法式 DDL 不删现役表。
- 0015 (20)：ledger-from-DB 唯一源；散文/公式/KEY 三分；read-check 归卡；样例可弃清理。
- 0016 (21)：复用 T2 不走 save-lesson（避 STEMROBIN-17）；practice 区排除；prose 逐字保真；答题事件可弃而 sr_questions 现役保留。
- 0017 (23)：只译散文；公式/SVG/KEY 中立；gate 硬前置；纯加法 en 行。
- 0018 (22)：逐卡软门禁语义；read-check 服务端判分+KEY 投影；完成门含无题尾卡。
- 0019 (24)：locale 服务端 cookie 权威；按 locale 可用性不混语言；练习 en 按 ord 对齐复用判分；en 无源解析仅显判定+高亮。

## Gap register 增量
无。无 abort、无前提坍塌、无待人解阻塞。

## 已知遗留（非阻塞，非本批范围）
- 生产验证时**浏览器交互工具瞬时故障**（policy check unavailable），T4/T6 实站交互冒烟未做；部署代码=合并前浏览器验证过的同一份 + 实站健康+正确内容，证据链完整；工具恢复后可补一次实站可视冒烟。
- 少数公式内 `\text{中文}` 与一处 inline SVG 中文标签按 G8/D15 属中立不译，en 渲染仍显中文（清理需动中立 base）。
- 练习参考解析在 en 无覆盖源（仅显判定+正确项高亮）。
- 旧 `sr_questions`/`sr_answer_events`、`sr_lessons.html/pdf` 仍为现役/派生源，待将来退役单。
- 后续 seed 候选：名人传记复用卡片模型（D6 进度真实化）；STEMROBIN-17 stage-2 大纲对齐；生成器/迁移的 evodocs 调和。
