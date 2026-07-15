# 0026 tkt STEMROBIN-31

- kind: tkt
- ticket: STEMROBIN-31
- type: story
- batch: 0005-progress-and-access
- merge_commit: 0c8851e
- seed: STEMROBIN-26
- consumes: []

## Background
需求⑤：全站需登录才能看任何页面。

## Decision
`app/src/routes/_app.tsx` 父路由加单一 `beforeLoad` gate：除 `/login` 外，未登录（`getCurrentUser` 无用户）一律 `throw redirect({to:'/login'})`。SSOT 单点、跑在 loader 前故未登录不触发受保护 DB 读。沿用现有 HMAC session、无注册、`sr_users` 只读。

## Consequences
- 改 app/ → 已 Azure 重部署 rev 0000028（commit 883edd7）。
- cap9：单一 gate、47 单测、构建净；子代理 5/5 浏览器；生产验证：未登录 /lesson → 跳 /login（内容不可见）。
- 遗留（非阻塞 G1）：未登录在 /login 仍可见目录侧栏（仅课标题，无正文/练习/PDF）——子代理判为导航非内容、可接受；更严的 bare login 留后续。

## Proxy decisions
grill cap13 自裁无 leak。核心：单一父路由 gate（非逐路由散检）、/login 豁免防重定向环、复用现有 session 不引新依赖、登录页显示目录标题(仅导航)判为可接受。
