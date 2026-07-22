# Batch 0015-practice-audio — 工单清单
Seed：STEMROBIN-106（人类意图 · 显式批准 · release gate 2026-07-22）· 1 seed = 1 batch
目标：孩子能把一课的跟读练习音频下载到手机上听——报课、每句连读两遍、有留白跟读的节奏。

| 工单 | 类型 | 摘要 | blocked_on |
|---|---|---|---|
| STEMROBIN-107 | enabler | 练习音频的合成与入库（可配置遍数/停顿，保存即生成 + 回填） | — |
| STEMROBIN-108 | story | 课文页一键下载练习音频（`mt-<课id>-<标题>.mp3`） | 107 |

## 人类在 release gate 上定的三件事

1. 开头念 `Lesson <序号>. <标题>.`，不字面念课 id。
2. 本批次现在就开，**0014-voa1500-infra 挂起**（101 单元 2–12、97、98、103 未做，等本批收完再续）。
3. 下载是「点一下直接下载」：服务端直返 mp3 + `Content-Disposition: attachment`，不做在线播放器。
