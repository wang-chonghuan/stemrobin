# 0067 tkt STEMROBIN-114

- kind: tkt
- ticket: STEMROBIN-114
- type: story
- batch: none
- lane: express → standard (predicates 2 and 4)
- merge_commit: 96e52d6b349db90e28e9301c51226d048c261d0f
- seed: none
- consumes: []

## Background

教材练习的错误提交原先只有可丢弃的答题事件，没有面向学习者的持久错题历史，也没有从个人资料入口按日期查看并回到原题重做的流程。

## Decision

新增专用持久表 `sr_textbook_mistakes`，每次错误自动判分提交都与既有答题事件在同一事务写入；后续答对不修改历史。错题本放在 profile dropdown，当前按 UTC 日期分组，并通过 typed route search 打开练习 tab、标记并滚动到原题。

工单虽以 express filing，但真实 diff 包含 schema contract change，且存储生命周期未在工单中预先决定，因此按规则 reroute 到 standard，完整执行 draft、grill、spec/plan、开发和验收。

## Consequences

- 错题记录独立于 disposable answer events，也不会因课文行替换而级联删除；删除用户时仍随账号清理。
- 线上 revision `ca-stemrobin--0000070`（commit `96e52d6`）已在 `https://lemmadeck.com` 实测：真实错误提交生成一条记录，按 UTC 日期显示，重做精确定位第 9 题，正确重交后原记录保留且不新增错题；桌面和移动端均通过。
- Vitest 72/72、生产构建、schema 幂等与事务回滚探针、既有 scroll-restoration Playwright 均通过。
- n-im 所引用的 `nf-db` capability 当前未安装；本次使用仓库现役 Node `postgres` + `LEMMADECK_DATABASE_URL` 路径。旧 charter/schema 文案中的 `stemrobin-schema` 漂移留待后续边界处理。

## Proxy decisions

- 用户可见错题历史使用专用持久表，不提升 `sr_content_answer_events` 的生命周期。
- 只向现役 `lemmadeck-schema` 增加 marker-bounded DDL，不执行或重定向遗留 Azure schema 段。
- `lesson_id` 保留为历史标识但不建立 lesson 删除级联；`user_id` 保留账号删除级联。
