# 0031 tkt STEMROBIN-35
- kind: tkt
- ticket: STEMROBIN-35
- type: story
- batch: 0006-titles-auth-cleanup
- merge_commit: 48e8d53
- seed: STEMROBIN-32
## 摘要
显示课文/section 标题 + 速览课后题（seed G-2 UI/G-3）：卡片精读显示课文标题+当前 section 标题(读自 card.name)；全文速览显示课文标题+各 section 标题+课后题列表(只显示、无控件、无 server 调用、不判分不计进度、来源 KEY-free)。仅 app。cap9：76 单测、10/10 浏览器；生产验证卡片/速览标题+课后题+公式+移动全过。遗留 D4(非阻塞)：en 下课文/section 标题仍显中文(无译文节点)。无 grill-leak。
