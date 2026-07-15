# 0030 tkt STEMROBIN-34
- kind: tkt
- ticket: STEMROBIN-34
- type: enabler
- batch: 0006-titles-auth-cleanup
- merge_commit: 4a029c8
- seed: STEMROBIN-32
## 摘要
恢复 section 中文名 + 生成器必产（seed G-2）：临时脚本 restore-section-names.mjs 从 STEMROBIN-21 快照恢复每卡 section 中文名入 content JSONB（留 content-backup 快照、幂等）；生成器 check-content 必带 name、render-lesson 渲染并删除有损 ANCHOR_NAME 字典（content JSONB 为唯一源）。cap9：0 卡缺 name(16课)、spot-check 正确(为什么学这个/讲解/例题/联系/口试)、10 单测、生成器样例证明；sr_users/正文/title 未动。遗留：html/pdf 缓存未重渲（由 35 从 JSONB 渲染）。无 grill-leak。
