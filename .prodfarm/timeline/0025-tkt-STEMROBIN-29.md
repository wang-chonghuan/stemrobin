# 0025 tkt STEMROBIN-29

- kind: tkt
- ticket: STEMROBIN-29
- type: enabler
- batch: 0005-progress-and-access
- merge_commit: b639a37
- seed: STEMROBIN-26
- consumes: []

## Background
需求③④的地基：练习 attempt/分数 存储 + 进度计算，供 STEMROBIN-30 的首页真进度条消费。

## Decision
- 新表 `sr_practice_attempts`(user_id, lesson_id, score 0..100, submitted_at)，**每用户每课只留最近两次**（落库路径剪枝，非触发器，按人裁决）。
- `app/src/lib/progress.ts`：`recordPracticeAttempt`（登录才写、剪枝到2）、`getProgress`（每课课文/练习完成 + 总点/已完成）、纯 `computeProgress`。
- 课文完成 = 走完全部卡片（该课每道 read-check 有正确事件，从 `sr_content_answer_events` 派生，无新表）；练习完成 = 最近一次 attempt ≥80%（可回退）；**总点 = 2×课数 = 2×16 = 32、跨语言合一**。

## Consequences
- schema 加法应用生产库；progress.ts 为服务端能力，暂无 UI 消费（30 接）→ app 运行时行为不变、**无需重部署**（随 28/31 一并合入 883edd7）。
- cap9：schema 在库、59 单测过、psql 证 latest-2 剪枝 + 课文/练习双向回退（85%→完成、后 50%→回退）；content/`sr_users`/16 课未动。
- 遗留（非阻塞 BD-4）：含内容但零 read-check 的课（math-s2-08）判为课文永不完成（保守，避空真）；人 seed 未裁，留 handoff 可覆盖。

## Proxy decisions
grill cap13 自裁无 leak。核心：latest-2 落库路径剪枝、课文完成派生自事件不建表、进度按课跨语言合一、零-readcheck 课保守判未完成。
