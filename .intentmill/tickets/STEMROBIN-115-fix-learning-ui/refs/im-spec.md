# IntentMill Spec

## Intent

修复已上线学习体验中的四项异常：全量 5m edition 审计发现第 1 题仍按 1、4、2、5、3、6 显示、第 27 题按 1、3、2、4 显示，且共有 18 道带序号题未逐项换行；数学答案框首次聚焦时当前默认选择“基础”；手机视口中顶部栏和页面底部存在遮挡；已登录用户的 app 主页尚未显示错题本掌握摘要。修复后这些现象应在全部已生成 5m 课程及现有学习界面中消失。

## Scope

- 检查并修复全部已生成 5m 练习题。
- 让数学键盘首次显示即使用“更多”模式。
- 让手机端 topbar 固定在顶部且不遮挡正文，并让页面底部内容完整可达。
- 在已登录用户的 app 主页显示“已改正 / 总错题数”的错题本卡片。

## Requirements

1. 检查全部已生成 5m 课程时，所有完整数字分题序号均按 1 到 N 的自然顺序逐项换行；任一可作答教材题首次聚焦答案框时，数学键盘直接处于“更多”模式。
2. 在手机视口浏览 app 主页和教材页时，topbar 始终固定且不遮挡正文，页面底部可完整到达；已登录用户的 app 主页可见错题本卡片，并显示可由实际答错后答对流程验证的“已改正 / 总错题数”。

## Confirmed Decisions

- 今后的 edition 生成必须阻止序号错序或未逐项换行的题通过。
- 数学键盘首次显示即使用“更多”模式。
- 手机端 topbar 始终固定在顶部，正文不被其遮挡，页面底部内容可完整滚动到达。
- app 主页错题本卡片沿用现有错题及答题事实，以“已改正 / 总错题数”呈现。

## Non-Scope

- 不只修当前可见题。
- 不新增 schema、依赖或第二套错题事实来源。
- 不改变答案 key 的服务端保密边界。
- 不修改知识星图、教材图片或无关页面。

## Critical Existing Contracts

- 5m 的原始抽取层保持不变；修复写入现代 edition，并通过现有发布器覆盖数据库课程行。
- 课程发布保留已有 answerKey，不直接手写 `sr_lessons`。
- 错题总数来自 `sr_textbook_mistakes`；已改正状态由同一用户、同一 lesson/exercise 在错题时间之后出现正确 `sr_content_answer_events` 派生。
- `/learn` 是已登录用户的 app 主页；`/_app` 仍保持公开 shell，私有数据由子路由现有 auth gate 保护。
- 使用现有 teal、green、white token、卡片和 app shell 模式。
- 顶部栏仍在 detail flex 布局中占据正常空间，不以覆盖正文的方式固定。

## Compatibility And Regression Constraints

- 已有答案、错题历史、答题事件、课程身份和图片保持不变。
- 桌面端 catalog/detail 布局、locale 菜单、普通课程导航和 scroll restoration 保持可用。
- 中文和英文 UI 字符串保持完整。
- 无 schema、配置、secret、外部 API、依赖或 charter 变更。

## Open Questions

None.
