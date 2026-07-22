# 0064 batch 0015-practice-audio

- kind: batch
- batch: 0015-practice-audio
- seed: STEMROBIN-106
- charter_commit: none

## Decisions and rationale

Seed STEMROBIN-106（人类意图，原文保留在工单里）：课文页要能一键下载一条跟读练习音频 —— 先报课，然后每句连读两遍、两遍间停 1 秒、句后停 2 秒，遍数与停顿可配置；音频提前生成好放在库里。

立批前的调查全部是实测，不是推断：Azure TTS 返回的是 MPEG-2 Layer III / 24 kHz / 128 kbps 单声道，帧长 384 字节 / 24 ms；产品里已有 mp3 直接 `Buffer.concat` 的先例（〔对话〕课的整篇音频）；用同帧头 + 全零帧体构造的静音帧可以零依赖拼出任意时长静音 —— 原型拼出的 371 KB 音频在浏览器 `decodeAudioData` 解出 23.76 s，与按码率推算的 23.8 s 差 0.05 s，RMS 包络显示语音块之间是干净静音。因此 **不需要 ffmpeg、不需要新增依赖**（宪章 · 无谓依赖为铁律），也 **不需要改 schema**（`sr_lesson_audio` 按 node 存放，新增一个 node 即可）。

自我 grill 抓到一个机器无权裁决的产品问题并上交人类：「首先读 lesson [课id]」字面执行会念成 "english u zero one dash zero one"。

人类在 release gate 上裁决三条：

1. 开头念 `Lesson <序号>. <标题>.`，文件名仍用完整课 id。
2. 本批次立即开工，**0014-voa1500-infra 挂起**（101 单元 2–12、97、98、103 未做，等本批收完再续）。
3. 下载是「点一下直接下载」——服务端直返 mp3 + `Content-Disposition: attachment`，不做在线播放器。

## Deferred

- 0014 剩余：101 的单元 02–12 分配、97 创作脚手架、98 规则对内容的校验、103 VOA1500 遗留清理。

## Veto handling

none

## Charter changes

none
