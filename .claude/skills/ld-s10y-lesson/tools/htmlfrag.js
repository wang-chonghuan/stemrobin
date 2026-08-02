/**
 * 文本 → 可直接嵌进宿主页面的 HTML 片段。
 *
 * 与 render_lesson.js 的整份自包含文档不同，这里产出的是**片段**：没有 <style>、
 * 没有内联字体、没有自己的排版。给 app 用的就是它——课文塞进 iframe 会变成"文档中的
 * 文档"，字体和版式与产品两套，高度还得靠 JS 猜（正是操作栏被压住的由来）。片段则由
 * 宿主排版，KaTeX 的 CSS 宿主装一次即可。
 */
const fs = require("fs")
const path = require("path")
const katex = require("katex")

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const escText = (s) => esc(s).replace(/\r?\n/g, "<br>")
// 原书用黑体排定义句，转写时记成 **…**
const strong = (h) => h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
const MATH = /\$\$(.+?)\$\$|\$([^$]+?)\$/gs
// 公式后面紧跟的标点要与公式绑在一起，否则 `$…$;` 的分号会被甩到下一行
const TRAIL = /^[;,.、，。：:！!？?)）\]]+/

function inline(text) {
  let out = "", last = 0
  for (const m of text.matchAll(MATH)) {
    out += escText(text.slice(last, m.index))
    const tex = m[1] ?? m[2]
    let html
    try {
      html = katex.renderToString(tex, { displayMode: !!m[1], throwOnError: false })
    } catch {
      html = `<span class="sr-tex-err">${esc(tex)}</span>`
    }
    last = m.index + m[0].length
    const t = (text.slice(last).match(TRAIL) || [""])[0]
    last += t.length
    out += `<span class="sr-nb">${html}${esc(t)}</span>`
  }
  return strong(out + escText(text.slice(last)))
}

/** 插图取矢量优先；SVG 直接内联，宿主可用 CSS 换色（fill 是 currentColor）。 */
function figureSvg(bookDir, id) {
  const svg = path.join(bookDir, "figures", `${id}.svg`)
  if (fs.existsSync(svg)) {
    return fs.readFileSync(svg, "utf8").replace(/<\?xml[^>]*\?>/, "").trim()
  }
  const png = path.join(bookDir, "figures", `${id}.png`)
  if (fs.existsSync(png)) {
    return `<img alt="" src="data:image/png;base64,${fs.readFileSync(png).toString("base64")}">`
  }
  return null
}

module.exports = { esc, inline, figureSvg }
