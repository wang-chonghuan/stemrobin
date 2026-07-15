# 0024 tkt STEMROBIN-28

- kind: tkt
- ticket: STEMROBIN-28
- type: story
- batch: 0005-progress-and-access
- merge_commit: 883edd7
- seed: STEMROBIN-26
- consumes: []

## Background
需求①：不答题也能看整篇课文（全文速览），且不带卡片小练习、不计进度。

## Decision
课程页加 逐卡精读|全文速览 切换（仅 app/）：全文速览把整篇课文全部卡片 body 连续渲染在一个复用课文 head 的 iframe 里，无 read-check、无门禁；逐卡精读保持现状（STEMROBIN-27 公式渲染不受影响）。全文速览不挂 CardReader → 结构性不产生 read-check 事件 → 不推进课文进度。文件：`reading.ts`(buildFullTextHtml)、`lesson.$id.tsx`、`i18n.ts`、`app.css` + 测试。

## Consequences
- 改 app/ → 已 Azure 重部署 rev 0000028（commit 883edd7）。
- cap9：52 单测、构建净；子代理 20/20 浏览器（全文速览显示全部内容/0 read-check/0 POST、切回逐卡公式渲染、移动 375px 无溢出）；生产验证：登录后课程页有切换、全文速览无 check。content/`sr_users` 未动。

## Proxy decisions
grill cap13 自裁无 leak。核心：全文速览连续渲染 JSONB body(非嵌 PDF)；结构性不记事件保证"只看全文不算进度"；切换 remount 重置每访 UI 态(非持久进度)避 display:none 测高塌陷。
