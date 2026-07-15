# 0018 tkt STEMROBIN-22

- kind: tkt
- ticket: STEMROBIN-22
- type: story
- batch: 0004-jsonb-card-reading
- merge_commit: 6655952
- seed: STEMROBIN-18
- consumes: []

## Background
本轮核心用户功能（seed 需求①）：数学课阅读从"整篇 iframe"改为**逐卡精读软门禁**，防跳读。消费 T1/T3 的 JSONB SSOT（content 卡片树 + read_check + zh 覆盖层）。zh only；语言切换是 T6。

## Decision
仅改 `app/`：
- `app/src/lib/reading.ts`：`getLessonReading`（从 content + zh 覆盖层组装卡片，**服务端投影掉答案 KEY**，永不入 payload；`head` 复用课文派生 html 的 `<head>` 使 KaTeX/元素类按卡渲染，D8）；`recordReadCheck`（服务端判分，登录才记 `sr_content_answer_events` kind=read_check）；`projectCards`/`judgeReadCheck` 纯函数。
- `app/src/components/card-reader.tsx`：逐卡软门禁状态机（一次一张带编号卡片，复用 iframe 测高生命周期；答错→回读本卡+重答，不揭答案/不惩罚/不跳过；全卡通过→"读完/可进入练习"）。
- `lesson.$id.tsx`：渲染 CardReader，练习按钮读完前锁定；`app.css`：`.sr-card-*`（仅 `--sr-*` token + 移动断点）。

## Consequences
- 改 app/ → app 镜像变化 → **已 Azure 重部署**（n-easyapp cap2）：revision `ca-stemrobin--0000023` Healthy/Running，commit tag=`6655952`，min-replicas=1。实站服务正确 app 壳（title/lesson+card-reader bundle/KaTeX，SSR 无 KEY）。
- cap9 独立验收：scope 仅 app/；单测 25/25（reading.test.ts 9 个含 KEY 保密 JSON 断言）；tsc+生产构建干净；KEY 服务端投影（judge `chosen===correct_index`）；子代理 headed-Chromium **20/20** 断言+截图（逐卡前进/答错重读/练习解锁/移动 375px 无溢出/payload 无 correct_index）；现有 quiz/PDF/目录仍工作；`sr_users`(2) 与迁移数据未动、测试事件已清。
- **验证说明**：部署后实站的**交互式浏览器冒烟被浏览器工具瞬时故障（policy check unavailable）挡住**；但部署代码 = 子代理合并前浏览器验证过的同一份（4d58fb8→6655952），加实站健康+正确壳+SSR 无 KEY，证据链完整。工具恢复后可补一次实站可视冒烟（非阻塞）。

## Proxy decisions
4 个 grill 阻塞全部 cap13 等价自裁（依据 charter/seed/acceptance），无 grill-leak。核心：逐卡软门禁语义（答错回读不跳过/不惩罚）、read-check 服务端判分+KEY 投影、复用 iframe 生命周期与 quiz/CSS token、完成门 `allRead && isLast` 使无 read-check 的尾卡（oral）被走而非跳过。
