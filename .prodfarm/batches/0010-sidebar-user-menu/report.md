# Batch 0010-sidebar-user-menu — report
Seed：STEMROBIN-54（human, full delegation）。1 story，done。
## 交付
- **STEMROBIN-55（story，7a8a55b）** 侧边栏账户菜单重设计：头像（邮箱首字母 tile）+名字 → 上拉卡片浮层（语言切换中/英 + 登出），移除顶部中英切换。按 DESIGN（三色、卡片圆角/边框、catalog-item 悬停、blue_tint 头像块）。纯前端，复用 setLocale/logout。
## 验收（dev + 生产实测）
- 顶部无语言切换；底部头像+名字；点击上拉浮层含语言(中文✓/English)+登出；切英文整个界面变英文；Esc/点外关闭；无 console 错误；prod 构建净；已重部署，生产站实测新菜单在线。
## 注记
- sr_users 无姓名字段，故名字=邮箱前缀、头像=首字母（seed 已记）。可访问：menu/menuitemradio 语义 + Esc/outside-close。
