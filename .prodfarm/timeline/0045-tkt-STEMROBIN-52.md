# 0045 tkt STEMROBIN-52
- kind: tkt
- ticket: STEMROBIN-52
- type: enabler
- batch: 0009-figure-aware-lessongen
- merge_commit: 56db25b
- seed: STEMROBIN-49
- consumes: []
## 摘要
练习题带图（跨 skill+schema+app）：sr_questions 加 `figure TEXT`（派生 SVG，随题展示）；deck item 可带中性 `figure` 规格，check-exercises 校验、save-lesson 经 figure.mjs 渲成 SVG 写入 sr_questions.figure、render-lesson 练习区渲图（.sr-p-fig）；app quiz.ts 选并投影 figure 到 QuizQuestion、quiz-drawer 经受控 SVG 注入渲在题干上方（.sr-quiz-figure）。验收：中心角图渲在练习抽屉「下面哪个角是圆心角？」上方、同 SVG 入 html 练习区（→PDF）、19/20 无图题不受影响、prod 构建净、生产站实测圆练习题带图渲染正常。**改 app→已 n-easyapp 重部署（生产实测通过）**。schema 变更走 ssot-schemas + psql。合并 56db25b。
