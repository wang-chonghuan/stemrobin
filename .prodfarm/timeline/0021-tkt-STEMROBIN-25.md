# 0021 tkt STEMROBIN-25

- kind: tkt
- ticket: STEMROBIN-25
- type: fix
- batch: none（direct fix lane）
- merge_commit: f75709f
- seed: none
- consumes: []

## 摘要
题目暂时限定为纯选择题（可逆）：生成器新增 `question-policy.mjs`（`CHOICE_ONLY` 开关，`check-content`/`check-exercises` 改用之），input 能力全保留（schema/app/renderer/`validateItemKey` input 分支未动，一行可恢复）；现存数据中 read-check 的 40 道 input（跨 15 课）重做为 4 选项诊断选择题（练习 deck 本就 0 input），经确定性 saver + en 覆盖层重译落库。cap9：psql input 计数 0/0、覆盖不丢（130 read-check 全 choice）、en==zh、KEY 泄漏 0、`sr_users`(2) 完好、单测过（含 reversibility）。skill-only + 数据已 live → 无需重部署。副作用：`translate-lesson.mjs` 硬编码路径致 STEMROBIN-23 refs 下 15 份 en worksheet 同步更新（dev 产物，无害）。

## Proxy decisions
grill cap13 等价自裁，无 leak。核心：以 policy 开关实现"暂时可逆"而非删 input；input 数据重做为合格诊断选择题而非机械转换/丢题；改 en 覆盖层保持 en==zh 覆盖。
