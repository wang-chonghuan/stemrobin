# 0042 batch 0009-figure-aware-lessongen
- kind: batch
- batch: 0009-figure-aware-lessongen
- charter_commit: 本 boundary 直推 main（仅 .prodfarm 立批归档）
## Decisions and rationale
seed STEMROBIN-49（full delegation）：彻底升级课程生成 skill，从“代数思维（文本+KaTeX 为主、每课一张图、事后检验）”改为“按领域自适应 + 图一等公民 + 事中/草案检验”。人机四点共识：①不预设=必要性检验非计数；②练习题带图必跨 skill+app+schema；③拿代数课反向验证不误加图；④图工具锁 build 期 spec→SVG（非运行时交互库、correct-by-construction）。拆 4 单，DAG 50→{51,52}→53：T1 图工具、T2 蓝图流水线+事中检验+去预设、T3 练习题带图(schema+app)、T4 重生成圆两课+反向验证。老课不改。
## Deferred
- 交互式几何图（可拖动）明确排除，作为更大的后续方向。
## Veto handling
none。
## Charter changes
无。仅 .prodfarm 立批归档直推 main。
