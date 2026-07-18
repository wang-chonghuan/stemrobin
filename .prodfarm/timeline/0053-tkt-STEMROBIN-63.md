# 0053 tkt STEMROBIN-63
- kind: tkt
- ticket: STEMROBIN-63
- type: story
- batch: 无
- merge_commit: cc27157
- seed: 无
- consumes: []
## 摘要
首页「新上线课程」区改双栏,为潜在购买者(家长)增长服务:桌面端左栏=学习原理讲解、右栏=新上线课程网格;手机端新课在上、原理讲解卡片在下(用 grid order,无额外 DOM)。新课只取最新 6 门(availableLessons.slice(-6),中英各按本语言可用内容取)。原理列以「提取练习/主动回忆」为核心(绿色 hero 卡「每张卡片,读完都要"想起来"一次」),下接 卡片式微学习 / 即时反馈 / 学懂才前进 / AI 定制路径 四条;AI 项与已上线功能一致不夸大。文案中英双语走 i18n(ov.learn.*),视觉沿用 DESIGN 三色不加新色相。改动仅 3 文件:routes/_app/index.tsx、lib/i18n.ts、styles/app.css。验收 dev + 生产实测:桌面双栏、手机堆叠无横向滚动、最多 6 门、切英文无中文残留;tsc 净、无 console 错误。合并 cc27157,已重部署生产(revision ca-stemrobin--0000038, commit 标签匹配)实测。旁记:npm run test 有 1 项预存失败 locale-behavior.test.ts(STEMROBIN-52 加 figure 字段后未更新期望键集,非本工单,已另开跟进)。
