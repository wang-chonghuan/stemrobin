# Batch 0012-english-voa1500 — 工单清单（冻结）
Seed：STEMROBIN-75（人类意图 · 显式批准）· 1 seed = 1 batch

| 工单 | 类型 | 摘要 | blocked_on |
|---|---|---|---|
| STEMROBIN-76 | fix | 移除侧边栏「机器人」空占位学科 | — |
| STEMROBIN-77 | enabler | 短文课库结构与内容形状（学科=english、分句、每句中文+音频引用、填空可判分、答案服务端保密） | — |
| STEMROBIN-78 | enabler | Azure GPT TTS 资源与朗读生成能力（经 n-azure，复用现有 Azure OpenAI 资源） | — |
| STEMROBIN-79 | enabler | 从 voa1500.md 抽取结构化核心目标词表（~1500，排除专业附录） | — |
| STEMROBIN-80 | enabler | sr-english-reader 生成技能（约束式集合覆盖 → 分句正文+每句中文+每句音频+覆盖报告） | STEMROBIN-77, STEMROBIN-78, STEMROBIN-79 |
| STEMROBIN-81 | story | 生成并验收 60 篇 VOA1500 课文（100% 覆盖，不可达即中止交人） | STEMROBIN-80 |
| STEMROBIN-82 | story | 「短文学英语」栏目 + VOA1500 目录（DB 驱动可用性、中英切换） | STEMROBIN-77 |
| STEMROBIN-83 | story | 课文读懂阶段：逐句读 + 逐句点读音频 + 逐句/整篇中文 + 读毕确认 | STEMROBIN-81, STEMROBIN-77 |
| STEMROBIN-84 | story | 背诵天梯：5 级填空→全文默写、逐句重练队列、辅助完成、服务端判分 | STEMROBIN-83 |

注：plane 的 helper 暂不支持原生 blocked_by 关系写入；本批以本文件 + status.json 的 DAG 作为 cap4 取单顺序的依据。
