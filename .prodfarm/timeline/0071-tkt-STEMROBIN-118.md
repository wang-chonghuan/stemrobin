# 0071 tkt STEMROBIN-118

- kind: tkt
- batch: 0016-practice-input
- ticket: STEMROBIN-118
- type: fix
- lane: express（步骤 6 对真实 diff 复检六条谓词，全部成立，未改道）
- merge: PR #33 → main c423975
- deploy: ca-stemrobin 已更新；线上 CSS 含 `sr-num-field`

## What shipped

作答框的形态本来就由答案键决定，只是从未投影到浏览器，于是所有框一律是 MathLive 公式编辑器。
服务端投影补两样：小问标签（`label` 与更早的 `id` 一起认）和输入形态（`judge=numeric` → 数字，
其余 → 数学）；只投影形态，不投影 `expected`，判分仍在服务端，判分链路一个字未改。

组件按形态分流：数字分支是原生 `input`（`inputMode="decimal"`）＋一个正负号按钮（数字键盘没有
减号，而绝对值与坐标两课都有负数标准答案）；其余仍走 MathLive。小问有自己的名字时标签就用它，
不再拼上「我的答案」。

## Evidence

三课 186 个作答部件中 160 个（86%）的标准答案是普通数字，需要代数表达式的是 **0 个** —— 即线上
没有任何一个部件需要 LaTeX 键盘，而 100% 的框都强制使用它。这是立单依据，也是这次改动的量级。

worktree 实测：390px 下第 13 课 205 题为 `inputmode=decimal` 原生输入、MathLive 虚拟键盘不出现，
填 7 判对、201 题填 999 判错、203 题用 ± 把 25 变 -25；第 1 课第 2 题三个标签为 1/2/3（该题答案键
用的正是旧的 `id` 字段），第 16 课 262 题八个标签为 M/K/P/N 的向右向上并各带单位「格」。
Playwright 2/2、vitest 75/75、`tsc --noEmit` 干净。部署后线上 CSS 含 `sr-num-field`。

## Decisions

- 只有 `judge=numeric` 走数字输入。`exact`（集合、是否）与不判分题仍用 MathLive —— 它们各自的
  正确形态是另外的题（点选、多选），属于交互规格那条线（STEMROBIN-120/121），不在本工单。
- 答案键里 `label` 与 `id` 两种小问名在读侧一起认。把语料统一写回一个规范名是答案技能的职责，
  这个投影只负责别让旧数据显示不出标签。

## Notes

- 数据漂移登记：三课 186 个部件里有 26 个（全在第 1 课）用 `id`、4 个（第 13 课）两者都无。
  `ld-s10y-answer/lesson-answers@1` 文档规定的字段是 `label`，所以这是语料违反了技能自己的契约。
