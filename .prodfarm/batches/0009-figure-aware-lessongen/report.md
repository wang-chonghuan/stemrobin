# Batch 0009-figure-aware-lessongen — report

Seed：STEMROBIN-49（human, full delegation）。4 单全 done。核心：把课程生成从“代数思维（文本+KaTeX 为主、每课一张图、事后检验）”升级为“**按领域自适应 + 图一等公民 + 事中/草案检验**”，一个 skill。

## 交付
- **STEMROBIN-50（enabler，66e266f）** figure.mjs：build 期 spec→SVG 生成器，correct-by-construction（点必落圆上、劣弧/等半径算出），静态、PDF 安全、三色调色板。
- **STEMROBIN-51（enabler，f0c8771）** 蓝图优先流水线 + 图规格入 content + 去“概念课=1图”预设。check-blueprint 授权前门按**必要性**卡（废图 fail、无计数）；check-content 校验 spec + 图-文一致性。
- **STEMROBIN-52（enabler，56db25b）** 练习题带图：sr_questions.figure 列 + deck figure 规格 + save/render + app 非转义渲染。**已重部署，生产实测。**
- **STEMROBIN-53（chore）** 用新流程重生成圆 10.1/10.2（图由需求决定：3/4 課文图 + 各 3 图题，全为 spec）；3.5 代数课反向验证 dry-run = 0 图。

## 四点共识兑现
1. 不预设=必要性检验：10.1=3图、10.2=4图、**3.5=0图**（同一门、同一门禁），由领域/内容需求决定，无计数下限。
2. 练习题带图确跨 skill+app+schema（如实拆到 T3）。
3. 反向验证：3.5 走新蓝图流程 = 0 課文图 0 图题，证明不误加图。
4. 图工具=build 期 spec→SVG（非运行时库），坐标由工具算，根治手写坐标错图。

## 验收（实测）
- 独立 gate-2：圆两课全 Pass（逐题重解 key+reveal、逐图渲染核对几何正确且匹配题意/题干、词汇闸净、边界全覆盖）。
- 生产站（登录实测，重部署后）：10.1 全文速览 6 图渲染、练习「如图…AB…是什么？」带图渲染正常；无 {{…}} 泄漏。
- 既有课程与算法课不受影响；3.5 dry-run 未保存。

## 遗留 / 注记
- gate-2 两条 cosmetic minor（10.1 ex04 干扰项提到图上未画的线段；10.2 例4/5 无独立图，e1 已覆盖）——非阻塞，未改。
- 交互式几何图（可拖动）仍为排除的更大后续方向。
