# 0046 batch 0010-sidebar-user-menu
- kind: batch
- batch: 0010-sidebar-user-menu
- charter_commit: 本 boundary 直推 main（仅 .prodfarm 立批归档）
## Decisions and rationale
seed STEMROBIN-54（full delegation）：侧边栏底部 email+登出较粗糙、不合设计系统。定调：底部改头像（邮箱首字母 tile）+名字（邮箱前缀）→点击向上弹浮层（语言切换中/英 + 登出），并移除顶部中英切换。无姓名字段→用邮箱派生。纯前端（catalog.tsx+app.css），复用 setLocale/logout。1 story。风险低。
## Deferred
无。
## Veto handling
none。
## Charter changes
无。仅 .prodfarm 立批归档直推 main。
