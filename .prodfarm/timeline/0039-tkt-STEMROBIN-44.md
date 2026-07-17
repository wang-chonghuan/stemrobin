# 0039 tkt STEMROBIN-44

- kind: tkt
- ticket: STEMROBIN-44
- type: fix
- batch: 无
- merge_commit: b0f72da
- consumes: []

## 摘要
修 STEMROBIN-20（JSONB 化，d0567f9）引入的潜伏回归：save-lesson.mjs 停写 app 练习题读取的关系表 sr_questions（且 deckToExercises 丢弃 choice 项的 answer），16 门迁移课因保留旧行未暴露；STEMROBIN-20 后**首次**新建课（3.9/3.10/3.11）交互练习为空（"这一课还没有练习题"）。修法（仅改技能侧，app/ 未动）：save-lesson.mjs 从 exercises JSONB + zh overlay 派生并 upsert sr_questions（题干/选项取自 overlay，correct_index/accept/answer 取自中性 key），按 (lesson_id,ord) upsert 以保留题 id 与学习者答题记录（避免旧 delete-cascade 抹历史，护 redline#2），缺 key.answer 则 fail-fast（作答后 reveal 为 NOT NULL）；check-content.validateItemKey 加 allowAnswer（练习题 choice 可带非空 answer，读没读题仍只 {correct_index}）；check-exercises 传 allowAnswer=true；persist.md 记录该投影。cap9 实测（登录测试号，本地连同一共享库）：3 课练习抽屉均非空、逐题作答得对错判定 + 作答后讲解 reveal、服务端判分（选项乱序仍判对）、答案 KEY 不入 overlay/html；既有 16 课未受影响；测试答题数据已清理。**内容 DB 驱动 + app/ 未改 → 无需重部署**，3 课数据已在共享生产库、生产站已生效。合并 b0f72da 直推 main。
