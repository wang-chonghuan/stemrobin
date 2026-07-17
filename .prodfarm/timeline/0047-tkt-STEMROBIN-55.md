# 0047 tkt STEMROBIN-55
- kind: tkt
- ticket: STEMROBIN-55
- type: story
- batch: 0010-sidebar-user-menu
- merge_commit: 7a8a55b
- seed: STEMROBIN-54
- consumes: []
## 摘要
侧边栏底部由粗糙的 email+登出改为设计系统一致的**账户菜单**：圆形首字母头像 + 名字（邮箱 @ 前缀）按钮，点击**向上弹**卡片浮层，含**学习语言切换（中文/English，当前项打勾）**与**登出**；**移除顶部中英切换**（语言收进浮层）。无姓名字段→用邮箱派生（首字母头像 + 前缀名）。复用既有 setLocale+router.invalidate 与 logout server fn。浮层点外/Esc 关闭、menu 语义可访问。仅改前端（catalog.tsx + app.css + i18n account.menu）。验收（dev+生产实测）：顶部无切换、头像+名字、浮层语言/登出齐、切英文整壳变英文、Esc 关闭、无 console 错误；prod 构建净、**已 n-easyapp 重部署生产实测**。合并 7a8a55b。
