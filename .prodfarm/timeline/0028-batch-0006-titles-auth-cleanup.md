# 0028 batch 0006-titles-auth-cleanup

- kind: batch
- batch: 0006-titles-auth-cleanup
- charter_commit: 本 boundary 直推 main（仅 .prodfarm 立批归档，无 charter 五文件改动）

## Decisions and rationale

由 seed STEMROBIN-32（full delegation）驱动。承前批之上做 6 项打磨/清理：① 解锁课后题（不必读完课文即可作答，seed 澄清指练习 deck）；② 恢复迁移时丢失的 section 中文名 + 课文 title（临时恢复 skill + 生成器必产）；③ 全文速览显示课文/section 标题 + 课后题（只显示、传统教材式）；④ 登录+登出页（无注册）；⑤ 从 app 代码彻底删名人传记（保留 sr-story skill+数据）；⑥ 英文品牌 stemrobin + 隐藏过长 slogan。

seed 级模糊点由**人亲自裁决**（第1点=解锁练习 deck、第3点=速览课后题只显示），记录见 batch grill.md。6 张工单，DAG：{33,34}→35；其余独立。风险低（多为 app 层 + 一处数据恢复/生成器改）。

## Deferred

- 名人传记的运行时复活（本批只从 app 删，skill+数据保留，将来若做传记卡片化再议）。
- STEMROBIN-29 零-readcheck 课的课文完成口径、两 attempt 表合并等前批遗留仍留后续。

## Veto handling

none。

## Charter changes

无（charter 五文件未改）。删传记仅动 app 代码、保留 skill 与数据，未改 goal（多语言/卡片精读北极星不变）。仅 `.prodfarm/` 立批归档直推 main。
