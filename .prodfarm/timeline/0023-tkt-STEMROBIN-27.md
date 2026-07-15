# 0023 tkt STEMROBIN-27

- kind: tkt
- ticket: STEMROBIN-27
- type: fix
- batch: 0005-progress-and-access
- merge_commit: 1402240
- seed: STEMROBIN-26
- consumes: []

## 摘要
修 read-check 题干/选项数学公式显示为原始 `$…$` 乱码。**真因（DOM 追踪定位）**：effect 其实早就 typeset 成功了首卡 read-check（katex 已渲染），但题干/选项走 `dangerouslySetInnerHTML`，`loggedIn` 异步 resolve 触发的 re-render 把 DOM 还原成原始 `$…$`，一次性 effect 不再补 → 首卡永久 raw。**修复**：MutationObserver 监听 checks 子树，任何 re-render 还原成 raw `$` 立即重 typeset（已渲染节点重跑 no-op、自愈不循环）+ 初始重试覆盖 CDN defer。仅改 `app/src/components/card-reader.tsx`。内容抽查：math-s3-07 通分题（5x/6）正确。cap9/终验：本地 DOM 追踪 + 生产站全卡片 raw 计数=0（首卡 check1 katex=5 稳定）、单测 47/47。app 改动 → 已 Azure 重部署 rev 0000027（commit 1402240）。

**过程教训**：先误判"一次性重试"为修复并合并（PR#14），实站验证才发现首卡仍 raw；又误加 preload（PR#15）反而破坏渲染；最终 DOM 追踪定位为 re-render 还原、用 MutationObserver 定案（PR#16）。cap6 的"实站经验确认"三次拦下未真修好的版本——验证纪律的价值。

## Proxy decisions
grill cap13 等价自裁，无 leak。核心：用 MutationObserver 自愈 dangerouslySetInnerHTML 还原、而非改题目渲染管线；不引服务端 KaTeX（守 charter CDN 约定 + 无冗余依赖）。
