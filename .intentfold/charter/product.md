# Product

Human-authored. The machine reads this as binding intent and never edits it.
Section shape is fixed — see `format.md`.

> Migrated 2026-08-05 from `.prodfarm/charter/goal.md`. The source carried a
> `DRAFT — AWAITING HUMAN CONFIRMATION` banner while its body marked two pillars as human-confirmed
> (2026-07-14, 2026-07-20). The confirmed parts are stated below as fact; the parts the source left
> open are marked `TODO(human)` rather than invented.

## Contract

**What this product is**

一个面向**一名 8 岁、理解力强的孩子**的自学课程产品(web 应用),现有两条支柱。

第一支柱是**初中数学/物理**:内容按初中标准(2022 版义务教育课标),解释按儿童认知,训练按严肃教材
——不阉割概念,只重排入口与坡度。三层材料:教师版知识骨架、学生版讲义(课文页)、练习题系统
(识别/表示/基础操作/反向推理/易错辨析五类题)。

课文页采用**卡片式精读**:课文不变、按语义打散成带编号的卡片,一次读一张,读完当场以轻量"读没读"题
(read-check)卡关,防止跳读/假读;走完全部卡片才算读完课文,之后进入练习题系统。

第二支柱是**短文学英语**(人确认 2026-07-20):以约 60 篇适合 8–12 岁的短文/对话,通过
"读懂 → 提示递减 → 全文默写 → 周期复习"让孩子有机记住 VOA1500 核心词。遵循同一原则
(内容按严肃教材、解释按儿童认知)。

**多语言**(人确认 2026-07-14):产品面向多语言学习者,目标 7–8 种语言,首个为英文。数学内容以中文为
源语言,学习者可切换语言学习;数学公式统一用标准数学记法、跨语言共享。短文学英语当前中英双语,
后续多语言。

**Who it is for**

主用户是一名 8 岁、理解力强的自学者。他要做的事是**独立走完一课**:读懂课文、通过 read-check、
做完练习并知道自己错在哪,不需要成人在旁翻译概念。

**What good looks like**

TODO(human) — 源文件写的是 `达成度判定标准: (awaiting human)`,并给了一个示例:
"数学 stage-N 全部课文与练习可用且孩子可独立完成一课"。这一条决定每个工单最终被什么标准评判,
需要定下来。

**What this product is not**

TODO(human) — 源文件没有非目标一节。`format.md` 认为这是最有用的一节:它是阻止范围一个
"听起来合理的工单"接一个地向外漂的东西。至少值得写清楚:是否做多用户/班级、是否做家长端、
是否做游戏化激励、是否做初中以外的学段。

## Tools

## Guidance

## Redlines

**A closed list, looked up — never judged.** Do not ask "is this a big deal?"; check whether the
action is on the list. If it is: **route around it, or stop and hand it to the human.** Never
proceed, never approximate, never decide on the human's behalf.

Every entry says which of the two it is — **forbidden outright**, or **not without the human's
explicit approval**. An entry that needs a read-through to apply is not a redline; write it as
Guidance instead (`format.md`, test 2).

1. **Editing this file** — forbidden outright. Product intent is the human's exclusively.
