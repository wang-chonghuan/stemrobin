# 0036 tkt STEMROBIN-40
- kind: tkt
- ticket: STEMROBIN-40
- type: enabler
- batch: 0007-reading-polish
- merge_commit: fccc499
- seed: STEMROBIN-39
## 摘要
从 JSONB 重渲 16 课 html/pdf（seed G-A/G-C）：新脚本 rerender-lessons.mjs 用未改动的 render-lesson.mjs 重渲派生 html/pdf(编号 sr-sec-num+恢复的中文名+样式化练习区)，修正 STEMROBIN-34 遗留的陈旧 html。render-lesson.mjs 本就美观、grill 自裁无需改。cap9：16 课有 sr-sec-num+恢复名、0 KEY、幂等+快照、样例证明；JSONB/sr_users 未动。skill+数据、无需重部署。无 grill-leak。
