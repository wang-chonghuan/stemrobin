# 0061 batch 0014-voa1500-infra

- kind: batch
- batch: 0014-voa1500-infra
- charter_commit: none

## Decisions and rationale
Seed STEMROBIN-92（人类意图，显式批准）：「把生成课文的基础设施彻底做干净，目的是：这个 seed 执行完后，我可以生成任何课，而不用再修修补补」。

立批依据是实测证据而非推测：`save-lesson.mjs` 从不与分配表对账，已写的两课即漏掉 16 个计划词（第 01 课 25→16，第 07 课 25→18），按此外推 70 课约 480 词会静默消失，且只有跑完全部课文才会发现。此外过程状态（改嫁决定、生成历史、词的处置状态）推导不出来却无处存放；词表缺口（my/into/child-children/缩写）一直是逐课被动撞见。

人裁定四项：SQLite 状态库入 git；已上线英语内容全部清零重来；课数由 60 放宽至 70（10 单元 × 7）以化解 1541 词的算术死结；全部词零豁免，不承认「12 岁孩子不适合的词」——maturity 判断由「排除」改为「路由到合适课次」。

同步完成 0013 边界结算：87/88/89（内容结构 v2 + 三层音频、课文页 v2、背诵天梯）已交付上线并 done；86/90/91 superseded（见 0013 收批报告）。全部英语课文、派生音频、全局单词发音已清零，数学/物理 30 课不受影响。

## Deferred
- 周期记忆 SRS 调度：仍留待后续 seed；sr_recite_attempts 已在 0013 预埋数据。
- 多语言（中英以外）：不在本批。

## Veto handling
none

## Charter changes
none
