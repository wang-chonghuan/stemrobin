# Batch 0015-practice-audio — 收批报告

Seed：STEMROBIN-106（人类意图 · release gate 2026-07-22 显式放行）
交付：STEMROBIN-107（enabler）、STEMROBIN-108（story），两张全部完成并上线。
提交：`53d0407`、`f238db2`；线上部署 commit `f238db24`。

## 交付了什么

孩子可以在课文页点一下，把这一课的跟读练习音频存到手机上：先听到 `Lesson 1. My Name and My Family.`，然后每句读两遍、两遍之间留 1 秒、一句读完留 2 秒再进下一句。单元 01 的七课都已生成（78–96 秒 / 1.2–1.5 MB），以后新写的课文在保存时自动带上。

## 关键决定

- **零依赖拼接**：不引入 ffmpeg 或音频库。语音复用库里已有的逐句 mp3，静音由「同一帧头 + 全零帧体」的 mp3 帧堆出来。产品里本来就有 mp3 直接 `Buffer.concat` 的先例（〔对话〕课的整篇音频），这次只是补上静音。宪章的「无谓依赖为铁律」因此没有被动摇。
- **不改 schema**：`sr_lesson_audio` 本就按 node 存放（`s1..sn`、`full`），练习音频只是新增一个保留 node `practice`，SSOT 里补了注释。
- **下载不走 base64**：PDF 是 220 KB，走 server fn 返回 base64 没问题；练习音频 1.4 MB，人也明确要「点一下直接下载」，所以新增 `/english-audio/$id` 直接返回字节并带 `Content-Disposition: attachment`。
- **报课念标题而不念课 id**：字面执行原话会念成 "english u zero one dash zero one"。这是 release gate 上人的裁决 1。

## 证据

- 第 01 课练习音频在浏览器 `decodeAudioData` 解出 **86.11 秒**，按码率推算 86.0 秒；RMS 包络显示句间约 2.2–2.8 秒、两遍之间约 1.3–1.8 秒的静音。
- 配置真的是配置：`repeats` 2→3 把第 02 课从 72.7 秒拉到 105.7 秒；`gapAfterSentence` 2→4 精确加 7×2 秒；`gapBetweenRepeats` 1→0 精确减 7×1 秒。
- 重新保存第 07 课，未执行任何额外命令就带上了练习音频。
- **线上**（部署 `f238db24`）：课文页 PDF 图标旁出现下载音频图标；`/english-audio/english-u01-01` 返回 200、`attachment; filename="mt-english-u01-01-My Name and My Family.mp3"`、1,362,816 字节，解码 85.18 秒、节奏正确。数学课页面没有该按钮，用数学课 id 请求该路由返回 404。

## 已知偏差（诚实记录）

配置写 1 秒的「两遍之间」，实听约 1.3–1.8 秒：每段 TTS 音频自带头尾静音，会叠加上去。插入的静音本身是精确的；要更紧凑就把 `gapBetweenRepeats` 调小。

## 未做 / 交回

- 0014-voa1500-infra 挂起中，等这批收完继续：101 的单元 02–12 分配、97 创作脚手架、98 规则对内容校验、103 VOA1500 遗留清理。
