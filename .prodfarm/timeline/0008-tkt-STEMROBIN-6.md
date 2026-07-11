# 0008 tkt STEMROBIN-6

- kind: tkt
- ticket: STEMROBIN-6
- type: fix
- batch: 无
- merge_commit: e6811e58116df26e31fd5da992e262408d92203c
- consumes: []

## Summary
从零重生成并保存 `math-s3-01`「3.1 未知数是什么」及 20 题练习，恢复大纲和目录标题，按已保存课程自动激活目录与顺序导航，并在 `sr-math-lesson` 保存前强制大纲、台账和练习契约校验及自包含练习样式；本地内容校验、Vitest、生产构建和 system-Chrome Playwright 验收均通过，合并提交 `e6811e5` 已部署到生产并完成同一组线上 Playwright 验收。

## Proxy decisions
none
