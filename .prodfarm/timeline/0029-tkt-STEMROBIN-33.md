# 0029 tkt STEMROBIN-33
- kind: tkt
- ticket: STEMROBIN-33
- type: fix
- batch: 0006-titles-auth-cleanup
- merge_commit: b734d66
- seed: STEMROBIN-32
## 摘要
解锁课后题（seed G-1）：移除 STEMROBIN-22 的"读完全部卡片才解锁"练习锁，课后题随时可开可答；课文进度仍只由卡片精读事件派生（两点独立）。仅 app（lesson.$id/card-reader/i18n）。cap9：68 单测、构建净、浏览器（未读完开练习+判分、课文点不授予）；生产验证练习未锁。无 grill-leak。
