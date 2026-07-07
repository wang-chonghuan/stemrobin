# 0002 tkt — STEMROBIN-2 课文页上一课/下一课导航

- kind: tkt
- anchor: STEMROBIN-2 (plane 9de15b09) · merge 6f5b7141 (PR #3, SR-3-lesson-nav)
- batch: 0001-lesson-nav

## 背景
课文页读完一课需回目录才能继续,不利于顺序学习。

## 决策
底部 pager 导航,`getLessonNav(id)` 以 AVAILABLE_LESSONS 为唯一顺序 SSOT,只在"有页面的课"间导航;边界禁用态;未知 id 不渲染。

## 后果
三条完成判据全部实证通过(合并前 worktree 独立重跑 40/40 浏览器检查,双视口);14/14 单测,回归地板绿。学习者可在课文间连续移动。

## Proxy decisions (cap13,人可 veto)
- G1 导航位置=课文底部(Scope 建议 + pager 惯例)
- G2 首/末边界=禁用态(判据允许两者,取默认+代码先例)
- G3 控件显示"方向 · 编号标题"(复用 getLessonLabel)
- G4 传记页不加导航(Out of scope + features/story-page.md 边界)

## consumes
None.
