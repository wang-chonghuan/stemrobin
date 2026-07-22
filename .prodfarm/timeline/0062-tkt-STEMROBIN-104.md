# 0062 tkt STEMROBIN-104

- kind: tkt
- batch: 0014-voa1500-infra
- tickets: STEMROBIN-100 (done), STEMROBIN-101 (partial · unit 01), STEMROBIN-96 (done), STEMROBIN-104 (done)
- commits: af48a4e, 13e4af5, 70b2192
- deployed: 70b2192e (ca-stemrobin)

## What shipped

单元 01 的七课英语课文上线，并把它们所依赖的三件基础设施做完：

- **100 词表切换**：闸门改读 `resources/content/course-wordlist.json`（牛津 3000 A1+A2，单一真相源，每词带 level/pos/source/lesson/state/movedFrom）。蓝图 v3 点名而 A1+A2 未收的 21 词入表（13 个从 B1/B2 提升，8 个 added-by-machine），此后蓝图 649 个点名词 100% 可写。
- **101 分配（仅单元 01）**：138 词写入 `lesson` —— 授课课每课 22 词、〔综合〕课 6 词，按各课蓝图场景挑选。单元 02–12 仍 unassigned，工单保持 In Progress。
- **96 保存即对账**：`save-lesson.mjs` 保存后即比对「计划 vs 实教」，漏词变成 `orphaned` 并给出建议新家，只能显式处置（改写正文 / `--rehome` 到未写课次 / `--defer`）；`reconcile.mjs --status` 有未处置漏词即退出 1。
- **104 内容**：01–07 七课，取蓝图场景与句型，7–8 句 / 73–96 词，逐句中文、三层发音、打印 PDF、天梯 L1–L5。

## Decisions and rationale

- **计划与状态只留一份 JSON**：删除 STEMROBIN-93 的 SQLite `state.db` 与其 `allocation.json` 快照、以及 70 课时代的 build/check-allocation 脚本。它们是第二真相源，而且仍读已废弃的 VOA 词表 —— 留着就等于留一条指向死数据的路径（宪章 · SSOT）。
- **词表查询提前于数字豁免**：牛津把 first/one/two 收为正式词条，而旧的「数字一律豁免」会让「第 03 课教了 first」不被计数。改为先查词表、查不到才走数字豁免。
- **`--dry-run`**：过闸门 + 对账但不合成朗读、不写库。此前每次改一句要付一分钟 TTS；这是 97「创作脚手架」的一小块，提前落地是因为写这七课时立刻就需要它。
- **侧边栏改称 A1A2**：命名裁决 #8。103 的其余清理（技能改名、废弃词表文件、schema 注释）仍未做。

## Evidence

- `audit-vocab` 退出 0：0 个词形还原 bug，21 must-resolve + 14 must-fail 全过；skateboard/gymnasium/backpack 仍被拒。
- 七课对账：01–06 计划 22 / 实教 22，07 计划 6 / 实教 6，138 词零漏词，`--status` 退出 0。
- 线上实测（部署 commit 70b2192e）：侧边栏 A1A2 下七课齐全；三层发音的 server fn 均 200（单词 wake / 句子 s1 / 整篇 full）；天梯五级齐全，第 5 级全文默写提交判「完全正确，整篇背下来了！」。测试账号的 recite 记录已清理。
- 单测 82 通过 / 1 失败（`locale-behavior.test.ts` 的 figure 断言，既有红灯，与本次无关）。

## Deferred

- STEMROBIN-101 余下部分：单元 02–12 约 1595 词的分配 + 最难安置词清单。
- STEMROBIN-97 / 98 / 103：脚手架与生命周期命令、规则对实际内容的校验（核心词 ≥3 篇复现）、VOA1500 遗留清理。
