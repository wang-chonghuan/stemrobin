# 0052 tkt STEMROBIN-60
- kind: tkt
- ticket: STEMROBIN-60
- type: fix
- batch: 无
- merge_commit: b4b183d
- seed: 无
- consumes: []
## 摘要
中文界面品牌字标改「八个树」(树加粗;人明确故意用"个"非"哥"——避八哥的土气/男性化、取"八个树"吸睛),英文界面仍 MynaTree,浏览器标题双语。首页 hero 换人定稿:大字"为每个孩子量身定制的 AI 数学老师 / An AI math tutor tailored to every child",小字"理解先于刷题:卡片式学懂再练熟;AI 全程跟踪进度、识别薄弱、推荐下一课、生成针对性练习、定制学习路径、持续超前"(英文镜像)。hero 结构/CSS 不变,仅换文字与字标(catalog/login 字标 locale 化、i18n、__root 标题)。验收 dev+生产:zh=八个树/en=MynaTree、hero 定稿到位、无 console 错误、构建净。合并 b4b183d,已重部署生产实测。
