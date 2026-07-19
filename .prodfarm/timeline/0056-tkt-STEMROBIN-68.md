# 0056 tkt STEMROBIN-68

- kind: tkt
- ticket: STEMROBIN-68
- type: story
- batch: 0011-open-access
- merge_commit: a8d41e0
- seed: STEMROBIN-67
- consumes: []
## 摘要
去掉浏览登录门禁：未登录即可浏览任意课程、逐卡阅读、作答课文卡片“读一读”小题并即时判分，但不保存进度；练习题成为登录墙。关键现状：数据层已支持——`recordReadCheck` 未登录判分不写库、`recordAnswer` 未登录返回“请先登录”；唯一全局门禁是 `_app.tsx` 的 beforeLoad 重定向。故为纯前端改动、无数据库迁移、无匿名进度数据模型。改动：`_app.tsx` 移除 beforeLoad 重定向（surfaces 公开、user 可空）；`lesson.$id` 未登录点「练习题」弹出免费登录提示 PracticeGateModal（强调完全免费·无付费墙·登录仅为保存进度），登录态照常开练习抽屉；catalog 未登录侧栏显示「登录·免费保存进度」CTA+语言切换；首页 hero 加“完全免费，没有付费墙”行、未登录进度显示 0%+“登录后免费保存进度”提示；登录页加免费徽标；i18n(zh/en)+CSS。验收（dev 3300 + 生产实测）：未登录浏览/做卡片小题得反馈且不保存、点练习得免费登录提示、三处免费文案可见、进度 0%+提示；登录态账户菜单/练习/进度/语言切换不变。合并 a8d41e0，已 n-easyapp 重部署生产（revision 0000039，实测未登录 200 不再跳登录、练习登录墙生效）。注：`locale-behavior.test.ts` 有一处早于本工单的陈旧断言（projectQuestions 已含 figure 字段），与本改动无关，已另开小 fix。
