# 0058 tkt STEMROBIN-73

- kind: tkt
- ticket: STEMROBIN-73
- type: fix
- batch: 无
- merge_commit: 37b50c4
- seed: 无
- consumes: []
## 摘要
figure.mjs 渲染层加排版防护 `fitViewBox`：图靠近边缘的文字标签（尤其 below/above 的 caption，基线落到 viewBox 外）会被 SVG 裁掉（4.5 三类三角形图中招，已先单点修数据 STEMROBIN-72）。改法：渲染出 body 后，正则量出每个 `<text>` 的横竖范围（按 font-size、text-anchor、CJK/半角估宽），把 viewBox 扩到能容下越界文字（留 4px 余量）；文字本就在 [0,0,w,h] 内则原样返回。回归扫描全库 94 张图：89 张字节不变（零回退），5 张（4.2×2、4.3×3）此前有轻微越界裁字、自动扩正，已重存烘焙。以后任何课的标签都不会再被裁。仅改技能 figure.mjs + 重存 4.2/4.3 内容，app 容器产物未变 → 无需重部署，共享库实时生效。合并 37b50c4。
