# Batch 0005-progress-and-access — 收官报告

Seed：STEMROBIN-26（full delegation，seed 级问题由人亲自 grill 裁决）· 结局：**done**（5/5 交付，无 abort）。

## 交付概要

| 单 | 类型 | 交付 | PR / merge | 部署 |
|---|---|---|---|---|
| STEMROBIN-27 | fix | read-check 数学公式渲染修复（MutationObserver 自愈 dangerouslySetInnerHTML 还原） | [#16](https://github.com/wang-chonghuan/stemrobin/pull/16) `1402240` | rev 0000027 |
| STEMROBIN-28 | story | 课程页全文速览模式（无 read-check、不计进度） | [#19](https://github.com/wang-chonghuan/stemrobin/pull/19) `883edd7` | rev 0000028 |
| STEMROBIN-29 | enabler | 练习 attempt 数据模型（最近2次）+ 进度计算 | [#17](https://github.com/wang-chonghuan/stemrobin/pull/17) `b639a37` | 随 0000028 |
| STEMROBIN-30 | story | 练习按次计分 + 首页真进度条 | [#20](https://github.com/wang-chonghuan/stemrobin/pull/20) `53cec43` | rev 0000029 |
| STEMROBIN-31 | story | 全站登录门禁（无注册，仅现有账号） | [#18](https://github.com/wang-chonghuan/stemrobin/pull/18) `0c8851e` | rev 0000028 |

**最终线上**：`ca-stemrobin` rev 0000029（commit 53cec43）。用户报的公式乱码 bug 已修；全文速览、真进度条、全站登录均已上线。

## 核心成果（对照 seed 意图）
- **全文速览**：课程页 逐卡精读↔全文速览 切换，全文一次看整篇、无 read-check、不推进课文进度。
- **公式 bug**：read-check 题干/选项数学符号原始 LaTeX 乱码修复（真因=re-render 还原 dangerouslySetInnerHTML，MutationObserver 自愈）。
- **每课两进度点 + 首页真进度条**：课文=走完卡片；练习=最近一次 attempt ≥80%（可回退）；总点=2×课数(32)、跨语言合一；首页真进度取代假数据（实测 90%→1/32、50%→回退 0/32）。
- **全站登录门禁**：除登录页外全部需登录、无注册、仅现有账号（单一 `_app` beforeLoad gate）。

## Proxy decisions（人可事后否决）
所有执行级 grill 由 cap13 等价自裁，无 leak。逐单基据见各 tkt timeline 0023–0027 的 Proxy decisions。seed 级问题由**人亲自裁决**（练习完成=最近一次≥80%可回退+只存最近2次；课文完成=走完卡片；进度跨语言合一；无注册全站登录），记录见 batch grill.md。

## 已知遗留（非阻塞）
- **STEMROBIN-31**：未登录在 /login 仍可见目录侧栏（仅课标题、无正文/练习/PDF）——子代理判为导航非内容、可接受；更严的 bare login 可后续。
- **STEMROBIN-29**：含内容但零 read-check 的课（math-s2-08）判课文永不完成（保守，避空真）。
- **STEMROBIN-30**：`sr_quiz_attempts`(分组) 与 `sr_practice_attempts`(记分) 两表略冗余；attempt-scoring UI 端到端点击流由单测+子代理覆盖，governor 未亲测（进度条实数据 + 回退已亲测）。
- 生产 SESSION_SECRET 用 dev fallback（charter 既有已知限制，非本批范围）。

## 过程记录
- **STEMROBIN-27** 绕三轮（PR#14 未真修好→#15 preload 回归→#16 MutationObserver 定案）；cap6 的"实站经验确认"三次拦下未真修好的版本，验证纪律的价值。
- 期间 Anthropic API 两波 ConnectionRefused/断线杀掉 27/29/30 的子代理；27 手工收尾、29 重启、30 governor 接手验证。均未丢数据（backend/worktree 为断点）。

## Gap register 增量
无。无 abort、无前提坍塌。
