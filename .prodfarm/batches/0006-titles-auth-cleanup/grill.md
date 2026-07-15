# Batch 0006-titles-auth-cleanup — grill 归档

来源：**released cap8 seed STEMROBIN-32**。人在会话中就模糊点被 grill 并裁决，其裁决 + 机器调查即本 batch 的 grill 记录。

## Release gate 裁决
- 模式：`full delegation`；结果：**已放行**，草案集（6 张）整体立批。

## 人裁决的 seed 级问题
- **G-1 解锁课后题**：第1点指**课后题（练习 deck）**——"课后题的卡片答题，不看完课文也要能打开，不能锁"。去掉 STEMROBIN-22 的练习锁；练习/课文进度两点独立。
- **G-3 速览课后题只显示**：全文速览里课后题**只呈现**（传统教材式），不在速览判分/计进度；正式作答走练习流程。

## 机器调查（已验证）
- **G-2**：`sr_lessons.title` 仍在库；卡片节点丢了 section 中文名（只剩 anchor+num），全文速览无课文 title。需临时 skill 从 STEMROBIN-21 迁移快照/原 HTML `sr-sec-name` 恢复 section 中文名入 content JSONB + 改生成器必产。
- **G-4/5/6**（清楚，机器默认）：登录/登出页无注册、用户后台手加；删传记仅动 app 代码保留 sr-story skill+数据；英文品牌 stemrobin + 过长 slogan 隐藏。

## Feasibility
- 解锁练习：改 app（练习按钮锁）。
- 标题恢复：临时脚本 + 生成器改，答题事件可弃、`sr_users` 不可动。
- 删传记：app 侧边栏/首页/story 路由/lib，保留 `.agents/skills/sr-story` + `sr_stories`/`sr_story_*`。
