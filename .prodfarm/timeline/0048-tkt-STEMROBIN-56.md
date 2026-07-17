# 0048 tkt STEMROBIN-56
- kind: tkt
- ticket: STEMROBIN-56
- type: fix
- batch: 无
- merge_commit: e86c2e1
- consumes: []
## 摘要
首页两处小修（app 前端）：移除总览页「科学与工程」pillar 卡片（与当前数学定位不符，连带删未用的 Atom import 与 ov.pillar1.* 用法）；侧边栏 logo 从纯图片改为到 / 的 Link（onNavigate 关移动抽屉），点击回主页。验收（dev+生产实测）：首页无该卡片、.sr-pillar=0、logo 点击导航到 /、其余区块不变、无 console 错误。与 STEMROBIN-57 同批一次部署（bundled）。合并 e86c2e1。人原话说"用 chore"，因改已发布 app 代码按契约归 fix。
