# Batch 0013-voa1500-v2 — 工单清单（冻结）
Seed：STEMROBIN-85（人类意图 · 显式批准）· 1 seed = 1 batch
课程 SSOT：`.agents/skills/sr-voa1500/outline.md`（人类蓝图 v2，机器一字不改）

| 工单 | 类型 | 摘要 | blocked_on |
|---|---|---|---|
| STEMROBIN-86 | enabler | 全量分词映射：1541 词按频率逐课分配 20–25 新词 + ≥3 复现计划，产出分配表交人过目 | — |
| STEMROBIN-87 | enabler | 内容结构 v2 + 三层 TTS 音频：句型/槽位/说话人进中性层；单词发音全课程共享、整篇朗读、对话双音色；保存管线升级 | — |
| STEMROBIN-88 | story | 课文页 v2 四区动线：句型卡→课文卡（说话人/实例标记/整篇播放）→生词卡（单词发音）→天梯入口；侧边栏平铺编号+单元分组 | STEMROBIN-87 |
| STEMROBIN-89 | story | 背诵天梯：五级至 L5 全篇背诵，挖空优先级 槽位>目标词>其余，辅助完成重练队列，服务端判分，背诵事件记录（SRS 预埋） | STEMROBIN-87 |
| STEMROBIN-90 | story | 样板课第 07 课〔对话〕全链路：新结构生成→页面→天梯→人体感验收；**验收通过是量产前提** | STEMROBIN-86, STEMROBIN-87, STEMROBIN-88, STEMROBIN-89 |
| STEMROBIN-91 | story | 按蓝图量产全部 60 课（含作废重生成 1–3），100% 覆盖 + ≥3 复现，不可达即停交人 | STEMROBIN-90 |

接替关系：STEMROBIN-89 ← superseded STEMROBIN-84；STEMROBIN-91 ← superseded STEMROBIN-81（见 0012 收批报告）。
注：plane helper 暂无原生 blocked_by 写入；本文件 + status.json 的 DAG 为 cap4 取单顺序依据。
