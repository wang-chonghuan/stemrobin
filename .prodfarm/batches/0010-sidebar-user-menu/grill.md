# Batch 0010 grill（cap11 自裁，seed STEMROBIN-54）
人发起、full delegation。纯前端 UI 重设计：把粗糙的底部 email+登出改为设计系统一致的用户菜单（头像+名字→上拉浮层：语言切换 dropdown + 登出），并把顶部中英切换收进去后移除。
cap11 自裁：可行性——组件/机制均已存在（catalog.tsx、setLocale、logout），无数据/后端改动；无待人裁产品决策（无姓名字段→用邮箱派生名字与首字母头像，已在 seed 记）；无 redline。风险仅在浮层交互/可访问性与设计一致性，用本地实测把关。1 单，低风险。
