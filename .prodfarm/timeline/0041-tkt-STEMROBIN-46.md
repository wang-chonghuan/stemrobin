# 0041 tkt STEMROBIN-46
- kind: tkt
- ticket: STEMROBIN-46
- type: fix
- batch: 0008-render-katex-hardening
- merge_commit: b55984d
- seed: STEMROBIN-45
- consumes: []
## 摘要
根治 render-lesson.mjs 两处 KaTeX-in-HTML 渲染缺陷（内容源干净，仅渲染坏）：(B) 模板注入用 `模板.replace('{{SECTIONS}}', html)`——字符串替换会解释 `$&`/`$$` 等；esc() 把 `$>$`→`$&gt;`，`$&` 被当「整段匹配」渲成 `{{SECTIONS}}gt;`。改为全部用**函数替换**（原样注入），根除。(A) 课文正文原样输出，裸 `$2<x$` 的 `<x` 被浏览器当标签吞后文；新增 check-content 守卫 `mathHtmlHazard`：拒绝「body 正文 `$…$` 内 `<` 紧跟字母」并提示改用 `\lt`。守卫**只作用于原样输出的正文**（read-check/deck/caption 均 esc() 转义、安全），裸算符 `$>$`/`$<$`/`$a < b$`/`$x<3$` 不误伤。验收：单测（`$2<x$`→HAZARD，`$>$`/`$<$`/`$a<b`/`$x<3$`→ok）；渲染 3.9 输出无 `{{…}}` 泄漏、q1 正确 `$&gt;$、$&lt;$`；守卫在三课正文共揪出 3+3+8 处裸 `<字母`（远超肉眼所见的例3）；浏览器全文速览三课 placeholderLeak=false、katex 正常。仅改 skill（render-lesson.mjs + check-content.mjs），app/ 未动 → 无需重部署。合并 b55984d 直推 main。
