# 0065 tkt STEMROBIN-107 / STEMROBIN-108

- kind: tkt
- batch: 0015-practice-audio
- tickets: STEMROBIN-107 (done), STEMROBIN-108 (done)
- seed: STEMROBIN-106 (done)
- commits: 53d0407, f238db2
- deployed: f238db24 (ca-stemrobin)

## What shipped

课文页可一键下载跟读练习音频 `mt-<课id>-<标题>.mp3`：先报课 `Lesson <n>. <title>.`，然后每句连读两遍、两遍间 1 秒、句后 2 秒。单元 01 七课已生成，新课在保存时自动生成。

## Decisions and rationale

- **零依赖拼接**：静音用「与语音同帧头 + 全零帧体」的 mp3 帧构造，语音复用库里已存的逐句 clip；产品已有 mp3 `Buffer.concat` 先例。不引入 ffmpeg / 音频库（宪章 · 无谓依赖为铁律）。
- **不改 schema**：`sr_lesson_audio` 新增保留 node `practice`，SSOT 文件补注释即可。
- **下载走 attachment 路由而非 base64 server fn**：音频 1.4 MB，比 PDF 大一个量级，人也要求「点一下直接下载」。
- **报课念序号+标题**：字面念课 id 会变成 "english u zero one dash zero one"（release gate 裁决 1）。

## Evidence

- 第 01 课解码 86.11s vs 推算 86.0s；包络显示句间 2.2–2.8s、两遍间 1.3–1.8s 静音。
- 配置生效：repeats 2→3（72.7s→105.7s）、gapAfterSentence 2→4（+7×2s）、gapBetweenRepeats 1→0（−7×1s）。
- 线上：按钮可见、路由 200 + 正确 attachment 文件名 + 1,362,816 字节、解码 85.18s；数学课无按钮、路由 404。
- 单测 82 通过 / 1 既有失败（locale-behavior figure 断言）。

## Deferred

- 配置写 1 秒的两遍间隔实听 1.3–1.8 秒（TTS clip 自带头尾静音叠加）；插入静音本身精确，需要更紧凑可调小配置。
- 0014 挂起项：101 单元 02–12、97、98、103。
