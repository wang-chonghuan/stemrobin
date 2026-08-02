## Ticket

## Meta
- Type: fix
- Batch: 无
- Origin: anomaly
- Seed: 无
- Lane: express

## Scope
修复已上线学习体验中的四项异常：全量 5m edition 审计发现第 1 题仍按 1、4、2、5、3、6 显示、第 27 题按 1、3、2、4 显示，且共有 18 道带序号题未逐项换行；数学答案框首次聚焦时当前默认选择“基础”；手机视口中顶部栏和页面底部存在遮挡；已登录用户的 app 主页尚未显示错题本掌握摘要。修复后这些现象应在全部已生成 5m 课程及现有学习界面中消失。

## Constraints
- 检查并修复全部已生成 5m 练习题，不得只修当前可见题；今后的 edition 生成必须阻止序号错序或未逐项换行的题通过。
- 数学键盘首次显示即使用“更多”模式。
- 手机端 topbar 始终固定在顶部，正文不被其遮挡，页面底部内容可完整滚动到达。
- 已登录用户的 app 主页显示错题本卡片，以“已改正 / 总错题数”呈现；沿用现有错题及答题事实，不新增 schema、依赖或第二套事实来源。

## Acceptance criteria
1. 检查全部已生成 5m 课程时，所有完整数字分题序号均按 1 到 N 的自然顺序逐项换行；任一可作答教材题首次聚焦答案框时，数学键盘直接处于“更多”模式。
2. 在手机视口浏览 app 主页和教材页时，topbar 始终固定且不遮挡正文，页面底部可完整到达；已登录用户的 app 主页可见错题本卡片，并显示可由实际答错后答对流程验证的“已改正 / 总错题数”。

## Live Charter

### Product Goal

为一名 8 岁、理解力强的孩子提供初中数学/物理的自学课程产品。核心原则：内容按初中标准，解释按儿童认知，训练按严肃教材，不阉割概念，重排入口与坡度。

产品形态是 web 课程应用，包含教师版知识骨架、学生版讲义和练习题系统。课文页采用卡片式精读，课文不变、按语义拆成带编号的卡片，读完当场以轻量 read-check 卡关，走完后进入练习系统。

产品面向多语言学习者，数学内容以中文为源语言，学习者可切换语言；数学公式统一用标准数学记法、跨语言共享。

第二支柱是短文学英语：通过读懂、提示递减、全文默写和周期复习掌握核心词汇，遵循同一严肃教材与儿童认知原则。

### Redlines

1. 未经人批准，不进行既定 n-easyapp redeploy 路径之外的首次或破坏性外部系统写入、公开发布、发送邮件或消息。
2. 不执行删除或污染共享生产 PostgreSQL 累积数据的不可逆操作。
3. 不产生新的经常性成本或超过 5 美元的一次性成本。
4. 不修改 `.prodfarm/charter/goal.md`。

### Engineering Rules

1. 编码前思考：不假设、不隐藏困惑，明确假设和取舍。
2. 简单优先：用解决问题的最小代码，不做投机性功能或不必要抽象。
3. 手术式修改：只改请求所需内容，不清理无关代码。
4. 目标驱动：把任务转成可验证目标，实际运行产品验证。
5. 单一事实来源：每个合同、schema、决策和操作只有一条 canonical 路径，不增加隐藏失败的 fallback。
6. 秘密只在 gitignored `.env` 中，提交前确认未 staged。
7. DB 访问保持 server-only，经 `app/src/lib/db.ts` 的共享连接。
8. 答案 key 不得进入初始浏览器 payload，判分保持服务端。
9. 内容由项目技能生成并通过其发布器持久化，不手写数据库课程行。
10. Dockerfile 和 build context 保持仓库根目录，Container App 不 scale-to-zero。

### Architecture

- 单一 TanStack Start SSR 应用位于 `app/`，使用 React 19、TypeScript、Vite/Nitro。
- 路由使用 `@tanstack/react-router` 文件路由；样式使用现有 teal、green、white 设计 token。
- 状态使用 zustand；数据使用 `postgres`，应用 DB 访问均通过 `app/src/lib/db.ts`。
- 教材内容由项目技能生成，现代 5m edition 位于 `resources/s10y-lessons/5m/editions/modern-us-neutral/`，通过 `.claude/skills/ld-s10y-lesson/tools/publish.mjs` 写入现役 `lemmadeck-schema`。
- `sr_lessons.content` 和 `sr_lessons.exercises` 是课程运行时事实；HTML 是派生渲染。
- 错题事实存于 `sr_textbook_mistakes`，答题事件存于 `sr_content_answer_events`。
- 不新增依赖、第二应用、第二 DB client 或第二内容发布路径。

### Runbook

- 开发：`cd app && npm run dev`，固定端口 3200。
- 单测：`cd app && npm run test`。
- 构建：`cd app && npm run build`。
- E2E：`cd app && npm run e2e`，需要已经启动的服务器。
- 内容技能从仓库根运行；教材发布使用项目技能的 `publish.mjs`。
- 部署：使用 n-easyapp 对项目 `stemrobin` 执行既定 redeploy。
- 线上地址：`https://lemmadeck.com`。

## Relevant Machine-Current Facts

- `app/src/components/math-answer-field.tsx` 当前把键盘 mode state 和 ref 初始化为 `basic`。
- `_app/learn.tsx` 是已登录用户的 app 主页，当前 loader 只读取课程、locale 和 deck stats。
- `app/src/lib/mistakes.ts` 当前按用户读取专用错题表；`sr_content_answer_events` 记录后续正确事件，可用于派生“已改正”而无需新 schema。
- `_app` shell 的 detail pane 使用 `.sr-detail`、`.sr-d-top` 和 `.sr-d-scroll`；当前 topbar 没有 sticky/fixed 定位，移动端需要安全区和可达底部验证。
- 5m edition 的 `normalize_numbered_subparts` 当前只识别半角 `)`，早期全角 `）` 题面绕过排序与换行；全量本地审计找到 18 道异常，其中第 1 题和第 27 题错序。
- 课程内容必须通过 edition 生成/审计/发布链路更新，不能直接手写数据库课程行。
