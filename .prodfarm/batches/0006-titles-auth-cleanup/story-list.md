# Batch 0006-titles-auth-cleanup — 工单清单（冻结）

Seed：STEMROBIN-32（full delegation，seed 级问题由人裁决）· 1 seed = 1 batch

| 工单 | 类型 | 摘要 | blocked_on |
|---|---|---|---|
| STEMROBIN-33 | fix | 解锁课后题（不必读完课文即可作答） | — |
| STEMROBIN-34 | enabler | 恢复 section 与课文标题（临时 skill）+ 改生成器必产 | — |
| STEMROBIN-35 | story | 卡片精读/全文速览显示课文+section 标题；速览显示课后题（只显示） | 33, 34 |
| STEMROBIN-36 | story | 登录页与登出（无注册） | — |
| STEMROBIN-37 | fix | 从 app 代码删除名人传记（保留 sr-story skill+数据） | — |
| STEMROBIN-38 | fix | 英文品牌显示 stemrobin + 隐藏过长 slogan | — |

DAG：{33,34} → 35；33/34/36/37/38 可并行。
