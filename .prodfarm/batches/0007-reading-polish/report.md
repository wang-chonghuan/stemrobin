# Batch 0007-reading-polish — 收官报告

Seed：STEMROBIN-39（full delegation）· 结局：**done**（3/3 交付，无 abort）。

## 交付概要

| 单 | 类型 | 交付 | PR / merge |
|---|---|---|---|
| STEMROBIN-40 | enabler | 从 JSONB 重渲 16 课 html/pdf（编号+名+样式化练习） | [#28](https://github.com/wang-chonghuan/stemrobin/pull/28) `fccc499` |
| STEMROBIN-41 | story | 全文速览改用 skill 渲染 html（= PDF 品质） | [#29](https://github.com/wang-chonghuan/stemrobin/pull/29) `0db139a` |
| STEMROBIN-42 | fix | 卡片精读 section 标题加编号 + 换色 | [#27](https://github.com/wang-chonghuan/stemrobin/pull/27) `bfa5f04` |

**最终线上**：`ca-stemrobin` rev 0000031（commit 0db139a）。生产验证 7/7 断言全过。

## 核心成果（对照 seed）
- **小节编号 + 配色**：卡片精读 section 标题现为"1 为什么学这个"（编号+名），色由近黑 `--sr-blue-deep` 改亮 `--sr-blue`(rgb 14,124,155)、加大加粗。
- **速览对齐 PDF**：根因是速览用了自建的简陋 `buildFullTextHtml`（无编号、bare `<ol>`）而非 PDF 的 skill 渲染器。改为**速览直接渲染 skill 产出的 sr_lessons.html**（编号 section + 样式化练习），并**删掉重复渲染器**（一个源）。配套从 JSONB **重渲 16 课 html/pdf**（补 STEMROBIN-34 遗留）。
- **课后题**：速览的课后题即 html 的练习区（prompt-only、无 KEY），自动 display-only（满足 seed G-3）。

## Proxy decisions（人可事后否决）
执行级 grill 全部 cap13 自裁，无 leak；逐单基据见 tkt timeline 0036–0038。其中 STEMROBIN-40 自裁"render-lesson.mjs 无需改、只需重渲"（PDF 本就美观，问题在存量 html 陈旧）；STEMROBIN-42 澄清"全黑"实为深色 `--sr-blue-deep` 近黑。

## 已知遗留（非阻塞）
- **STEMROBIN-35 D4**：en locale 下课文标题/section 名仍显中文（无译文节点）——仍留后续。
- `.sr-answer` 模板休眠类 + 授权注释为 pre-existing 非渲染 chrome（无答案数据），按外科原则未清，留后续可选清理。
- 前批遗留（零-readcheck 课口径、两 attempt 表、SESSION_SECRET dev fallback）仍留。

## 过程
Wave 1 并行 40(skill 重渲)+42(卡片标题) → Wave 2 41(速览用重渲 html)。多单合并后 main 64 单测 + 构建净、生产 7/7 断言过。全程 full delegation、零 abort。

## Gap register 增量
无。
