# 0055 batch 0011-open-access

- kind: batch
- batch: 0011-open-access
- charter_commit: none

## Decisions and rationale
Seed STEMROBIN-67（人类意图，显式批准）：去掉浏览登录门禁——未登录即可浏览课程与逐卡阅读、作答课文卡片“读一读”小题（判分但不保存进度）；练习题设登录墙且强调登录完全免费、无付费墙（登录只为保存进度）。设计经与人讨论定案：练习登录墙用弹窗提示、未登录首页进度显示 0%+登录提示、免费文案落在登录页/练习提示/首页 hero 三处。关键现状：数据层已支持该模型（`recordReadCheck` 未登录判分不写库、`recordAnswer` 未登录返回“请先登录”），唯一全局门禁是 `_app.tsx` 的 beforeLoad 重定向；故无需数据库迁移、无匿名进度数据模型。

## Deferred
登录后跳回原练习位置（redirect-back）留作后续优化，本批不做。

## Veto handling
none

## Charter changes
none
