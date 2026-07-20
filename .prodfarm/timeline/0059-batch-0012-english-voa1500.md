# 0059 batch 0012-english-voa1500

- kind: batch
- batch: 0012-english-voa1500
- charter_commit: 3367800（goal.md 追加第二支柱「短文学英语」；人于 2026-07-20 显式授权 redline #4 后落地）

## Decisions and rationale
Seed STEMROBIN-75（人类意图，显式批准）：移除侧边栏空占位「机器人」学科，新增「短文学英语」栏目，其下 VOA1500 目录含 60 篇短文课，让 8–12 岁孩子通过「读懂 → 提示递减 → 全文默写」有机记住 VOA1500 核心词。

发布 gate 四项裁决（详见 batches/0012-english-voa1500/grill.md）：(1) 写入 goal.md 作为第二支柱——边界动作，由人应用；(2) 100% 覆盖且严守 60 篇/120 词，接受尾部机械感，覆盖不可达即中止交人；(3) v1=栏目+60课文+完整天梯，周期记忆 SRS 拆为后续 seed；(4) v1 即做 Azure GPT TTS 真音频（经 n-azure 复用现有 Azure OpenAI 资源，逐句点读，中英）。

关键现状(证据)：`sr_lessons.subject` 有 `CHECK IN ('math','physics')`；阅读主干 reading.ts 走 sr_lessons 卡片+read-check+逐 locale overlay，可复用但无逐句结构/无音频/无填空/无复习态；应用内无任何音频/TTS；voa1500.md 有点号代空格与双栏交错伪影，需先抽取词表。故引入 T2/T3/T4 前置 enabler。

草案集 9 张（STEMROBIN-76…84）全部获批。依赖 DAG 见 status.json。

## Deferred
- 周期记忆（第 1/3/7/14/30 天间隔复习调度 + 每周 3 篇节流 + 长期掌握态）：拆为紧跟本批的后续 seed，不在 0012 内。
- 多语言（中英以外）：本批仅中英，后续语言后置。

## Veto handling
none

## Charter changes
goal.md 追加「第二支柱：短文学英语」(commit 3367800)。文本为人在发布 gate 批准的原文，人于 2026-07-20 会话中显式授权本次 redline #4 动作后由机器落盘；机器未自撰任何意图。
