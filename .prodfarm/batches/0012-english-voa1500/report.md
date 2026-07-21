# Batch 0012-english-voa1500 — 收批报告

Seed：STEMROBIN-75。结束方式：**边界结算收束**（2026-07-21）——人提交《VOA 1500 蓝图 v2》并批准课程重设计（新 seed STEMROBIN-85 → batch 0013-voa1500-v2），本批剩余两单被新规格覆盖。

## 工单结局（9 单）

| 工单 | 结局 | 说明 |
|---|---|---|
| STEMROBIN-76 移除机器人栏目 | done | 上线（0051628） |
| STEMROBIN-77 短文课库结构 | done | subject=english、分句/gloss/audio、投影保密（047dcf8） |
| STEMROBIN-78 Azure TTS | done | 复用既有 gpt-4o-mini-tts 部署，零新增资源（37e3883） |
| STEMROBIN-79 词表抽取 | done | 1541 词结构化词表（f746d1e） |
| STEMROBIN-80 生成技能 | done | 词表闸门/保存管线/覆盖报告（293755e） |
| STEMROBIN-82 栏目与目录 | done | 短文学英语 + VOA1500（780312c） |
| STEMROBIN-83 读懂页 | done | 单卡分行、三动线迭代、逐句点读（多次部署至 0000045） |
| STEMROBIN-81 量产 60 篇 | **superseded → STEMROBIN-91** | 蓝图 v2 变更量产规格（句型核心/分配表先行/样板先验收） |
| STEMROBIN-84 背诵天梯 | **superseded → STEMROBIN-89** | 挖空优先级改为槽位优先 + 背诵事件记录，从未按旧规格开发 |

## 沉淀资产（0013 沿用）

- 库结构：`subject='english'`、content JSONB 中性层 + `sr_lesson_i18n` overlay、`sr_lesson_audio`。
- 管线：`sr-voa1500`（改名自 sr-english-reader）——vocab 闸门 / tts / save（校验→朗读→PDF→事务入库）/ coverage。
- 词表：`resources/content/voa1500-wordlist.json`（1541 条，独立计数复核）。
- 应用：短文学英语栏目、课文页（读懂）、新词/复习自动区分、下载 PDF。
- 3 篇样章（The Little Cat / Cooking with Father / A New Friend）——按蓝图 v2 将作废重生成（人裁决）。

## 教训（供后续 grill 参考）

1. **课程结构应先于内容生成敲定**：本批在无人类蓝图的情况下开始样章与大纲草拟，人后置提交蓝图 v2 导致 81/84 返工。后续内容类 seed 应把「人类课程蓝图存在且冻结」列为量产前置条件（0013 已如此：86 分配表 + 90 样板验收先行）。
2. UI 未读 DESIGN.md 直接开写导致一次返工——设计系统契约必须在 UI 工单 grill 时显式核对。
