# 0053 tkt STEMROBIN-64

- kind: tkt
- ticket: STEMROBIN-64
- type: fix
- batch: 无
- merge_commit: 94a4713
- seed: 无
- consumes: []
## 摘要
逐卡精读视图把所有含图课的正文几何图渲染成字面 "undefined"（既有 bug，已上线的 10.1/10.2 同样受影响）。根因:正文图节点的作图源是声明式 `node.spec`,服务端 `render-lesson.mjs` 会算成 SVG 写入 html 缓存,但客户端投影 `app/src/lib/reading.ts` 的 `bodyToHtml` 只读 `node.svg`,故 spec-only 节点输出 `<figure>undefined</figure>`。修法遵循既有缓存范式(html/pdf/习题图 svg 都是派生缓存):`save-lesson.mjs` 在 upsert 前把 `svg=renderFigure(spec)` 烘焙进每个正文图节点(与 spec 并存),reading.ts 不动、app 代码零改动、不复制 figure.mjs 进 app(SSOT 不重复)。stage-10 五课(10.1–10.5,26 张图)全部经规范 saver 重存;`check-content` 接受带 svg 的正文节点(未来 dump+resave 安全)。验收 dev(3300)+生产实测:10.2/10.3/10.4/10.5 逐卡精读图形正常、无 undefined,与全文速览一致。因仅改技能 saver + 重存 DB 内容(共享库),app 容器产物未变 → 无需重部署,内容已在生产实时生效。合并 94a4713。
