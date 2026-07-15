# 0019 tkt STEMROBIN-24

- kind: tkt
- ticket: STEMROBIN-24
- type: story
- batch: 0004-jsonb-card-reading
- merge_commit: e772699
- seed: STEMROBIN-18
- consumes: []

## Background
批次收官单（seed 需求②端到端）：在 T4 精读流 + T5 en 覆盖层之上加 locale 维度，让学习者切换中/EN，英文下整套数学体验以英文呈现。

## Decision
仅改 `app/`（无新依赖）：
- locale = `sr_locale` cookie 服务端解析（`currentLocale()`）；`getLocale`/`setLocale` server fn，切换后 `router.invalidate()`；覆盖层/KEY 投影绝不信客户端 locale。
- 目录：zh 全大纲不变；en 仅显已译课（英文标题），丢未译占位+空阶段+隐藏传记区，阶段/课号由 id 推导保持真号。
- 阅读/read-check/练习按活动 locale 读 en 覆盖层；练习 en 文本取自中立 exercises + en 覆盖层（按 ord 对齐 sr_questions，1:1），复用现有数字 id 判分；公式/SVG 共享中立 base。
- 按 locale 可用性（D5）：译全才可读，不混语言回退；zh 恒可用。
- 新 `lib/i18n.ts`/`locale.server.ts`/`locale.ts`；改 lessons/reading/quiz/curriculum + catalog/card-reader/quiz-drawer + 路由 + css。

## Consequences
- 改 app/ → **已 Azure 重部署**（n-easyapp cap2）：revision `ca-stemrobin--0000024` Succeeded/Running，commit tag=`e772699`，min-replicas=1。实站服务正确 app（title/目录"课程大纲"/KaTeX，默认 zh 正常 → 证 zh 不变）。
- cap9 独立验收：scope 仅 app/、无依赖变更；单测 47/47（22 新）；tsc+构建干净；子代理 Playwright（en 目录/卡片/read-check/练习全英文、未译隐藏、zh 不变、en payload 无 KEY、桌面+375px 无溢出）+截图；overlays/content/`sr_users` 未动、测试事件清理。
- **验证说明**：部署后实站**交互式切换冒烟被浏览器工具瞬时故障挡住**；部署代码=子代理验证过的同一份（9fc7e0d→e772699）+ 实站健康+正确内容+默认 zh 正常，证据链完整。
- 现况：16 课全部已译 en，故"未译隐藏"由可用性规则单测 + 大纲省略占位证明（覆盖层只读，未造假课）。

## Proxy decisions
D1–D7 grill 全部 cap13 等价自裁（依据 charter/seed），无 grill-leak。核心：locale 服务端 cookie 权威、按 locale 可用性不混语言、KEY 投影不信客户端 locale、练习 en 按 ord 对齐复用判分、en 无覆盖源的参考解析仅显判定+正确项高亮（不半中半英）。
