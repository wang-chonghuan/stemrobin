# 0033 tkt STEMROBIN-37
- kind: tkt
- ticket: STEMROBIN-37
- type: fix
- batch: 0006-titles-auth-cleanup
- merge_commit: b734d66
- seed: STEMROBIN-32
## 摘要
从 app 代码删名人传记（seed G-5）：删 story 路由+stories.ts lib、侧边栏传记区、首页传记 pillar、story i18n；保留 .agents/skills/sr-story 与 sr_story_* DB 数据(读-only 确认未动)。仅 app。cap9：68 单测、构建净、浏览器(侧边栏/首页无传记中英、story URL 404、数学完好)；生产验证无传记/无 story 链接。无 grill-leak。
