# 0032 tkt STEMROBIN-36
- kind: tkt
- ticket: STEMROBIN-36
- type: story
- batch: 0006-titles-auth-cleanup
- merge_commit: a893dcd
- seed: STEMROBIN-32
## 摘要
登录页与登出（seed G-4）：登录页移出 _app 成顶层 bare 独立页(修 STEMROBIN-31 侧栏泄漏)；_app gate 简化；侧边栏底部加登出(邮箱+登出)复用现有 logout fn 清 HMAC cookie；无注册。仅 app。cap9：68 单测、13/13 浏览器(bare 登录/登入/登出后重新门禁)；生产验证 bare 登录+登出。无 grill-leak。
