# 0043 tkt STEMROBIN-50
- kind: tkt
- ticket: STEMROBIN-50
- type: enabler
- batch: 0009-figure-aware-lessongen
- merge_commit: 66e266f
- seed: STEMROBIN-49
- consumes: []
## 摘要
build 期 spec→SVG 图生成器 `figure.mjs`：作者写声明式语义规格（圆+按角度定位在圆上的点+圆心角+标注劣弧；或数轴+开/闭端点+着色射线），确定性算出正确坐标、输出自包含静态 inline SVG（三色 DESIGN 调色板、viewBox、aria）。无运行时 JS→静态 SVG 在課文 HTML 与 print PDF 都能渲染。把图作者从易错的手写 SVG 坐标改为 correct-by-construction 规格（点必落圆上、劣弧算出、等半径 tick）。验收：圆规格点到圆心距离=半径（精确）、数轴开端点+射线正确、确定性（多次一致）、headless-chromium 截图渲染正确（与 PDF 同引擎）。仅改 skill、app/未动→无需重部署。合并 66e266f 直推 main。此为 batch 0009 的地基，T2/T3/T4 依赖之。
