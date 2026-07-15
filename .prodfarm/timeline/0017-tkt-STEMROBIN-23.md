# 0017 tkt STEMROBIN-23

- kind: tkt
- ticket: STEMROBIN-23
- type: enabler
- batch: 0004-jsonb-card-reading
- merge_commit: a661150
- seed: STEMROBIN-18
- consumes: []

## Background
本轮"英文数学"的译文能力（seed 需求②，G8/D15）：从 zh 源 JSONB 产 en 文本覆盖层，只译散文，公式/SVG/KEY 中立继承。T6(语言切换端到端) 消费其 en 覆盖层。与 T4 并行开发。

## Decision
仅改 `.agents/skills/sr-math-lesson/`：`check-i18n.mjs`（确定性 gate：en==zh 覆盖、`$…$`/`$$…$$` 公式逐字节、inline `<svg>` 逐字节、HTML tag 多重集守恒、无 KEY、无 CJK 残留）；`translate-lesson.mjs`（emit/save/dry，gate 硬前置）；`translate-all.mjs`；`check-content.mjs` export `KEY_FIELDS`（SSOT）。译文 agent 撰写、并行 per-lesson 子代理各自 gate 自检，从主环境幂等落 `sr_lesson_i18n('en')`。无第三方 API/新成本。

## Consequences
- 仅 skill 代码 + 纯加法 DB（en 行 0→16）→ 无 app/Dockerfile/ssot-schemas → **无需重部署**。
- cap9 独立验收：16 en=16 zh；en/zh node 覆盖逐课相等；en KEY 泄漏=0；公式 2626 节点逐字节相等；SVG 中立不入 en；单测 12/12；base/zh/`sr_users`(2)/`sr_questions`(331)/16 课未动。
- 遗留（非阻塞）：少数公式 `\text{中文}` 与一处 inline SVG 中文标签按 G8/D15 属中立不译，en 渲染中仍显中文；清理需动中立 base（超本单加法范围），留后续。

## Proxy decisions
3 个 grill 阻塞全部 cap13 等价自裁（依据 charter + seed G5/G8 + plan D13/D15），无 grill-leak。核心：只译散文、公式/SVG/KEY 中立、gate 硬前置不落脏数据、纯加法 en 行。
