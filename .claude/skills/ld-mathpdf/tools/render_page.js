#!/usr/bin/env node
/**
 * cap5：把单页的 page.json / meta.json 渲染成自包含 HTML。
 *
 * 自包含 = 不依赖网络：KaTeX 服务端渲染成静态 HTML（页面无需 JS），
 * KaTeX 的 CSS 与 woff2 字体以 data URI 内联，插图 SVG 直接内联。
 * 双击即可打开。
 *
 * 半截表格规则（来自需求）：跨页的图/表只在**起始页**渲染。
 *   本页是上半截（cont_to_next_page）→ 渲染
 *   本页是下半截（cont_from_prev_page）→ 跳过，避免同一张表在两页各出现一半
 *
 * 用法: render_page.js <page.json|meta.json> <out.html>
 */
const fs = require("fs");
const path = require("path");
const katex = require("katex");

const SKILL = path.resolve(__dirname, "..");
const KATEX_DIST = path.join(SKILL, "node_modules", "katex", "dist");

// ---------- KaTeX 样式：把 woff2 内联成 data URI ----------
function katexCss() {
  let css = fs.readFileSync(path.join(KATEX_DIST, "katex.min.css"), "utf8");
  // 注意：katex.min.css 里 src 是 @font-face 的最后一条声明，以 } 结尾而非 ;
  // 用先行断言匹配到终止符前，终止符原样保留。
  let embedded = 0;
  css = css.replace(/src:[^;}]*(?=[;}])/g, (src) => {
    const m = src.match(/url\(fonts\/(KaTeX_[\w-]+)\.woff2\)/);
    if (!m) return src;
    const file = path.join(KATEX_DIST, "fonts", `${m[1]}.woff2`);
    if (!fs.existsSync(file)) return src;
    const b64 = fs.readFileSync(file).toString("base64");
    embedded += 1;
    // 只留 woff2，去掉 woff/ttf 的相对路径引用（自包含时它们必然 404）
    return `src:url(data:font/woff2;base64,${b64}) format('woff2')`;
  });
  if (embedded === 0) {
    throw new Error("KaTeX 字体一个都没内联成功——HTML 不会是自包含的，请检查 katex.min.css 结构");
  }
  return css;
}

// ---------- 文本 → HTML（行内公式用 KaTeX 渲染） ----------
const MATH = /\$\$(.+?)\$\$|\$([^$]+?)\$/gs;

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTex(tex, display) {
  try {
    return katex.renderToString(tex, {
      displayMode: display, throwOnError: true, strict: "ignore", trust: false,
    });
  } catch (e) {
    return `<span class="tex-error" title="${esc(String(e.message))}">${esc(tex)}</span>`;
  }
}

// 公式后紧跟的标点不得断行——否则 "$…$;" 的分号会被甩到下一行
const TRAIL_PUNCT = /^[;,.、，。：:！!？?)）\]]+/;

function inline(text) {
  let out = "", last = 0;
  for (const m of text.matchAll(MATH)) {
    out += esc(text.slice(last, m.index));
    const tex = m[1] !== undefined ? renderTex(m[1], true) : renderTex(m[2], false);
    last = m.index + m[0].length;
    const tail = (text.slice(last).match(TRAIL_PUNCT) || [""])[0];
    last += tail.length;
    out += tail ? `<span class="nb">${tex}${esc(tail)}</span>` : tex;
  }
  return out + esc(text.slice(last));
}

/** 整块就是一条公式时，走 display 模式（居中、\tag 右对齐） */
function blockMath(text) {
  const t = text.trim();
  const m = t.match(/^\$\$(.+)\$\$$/s);
  if (m) return `<div class="formula">${renderTex(m[1], true)}</div>`;
  return `<div class="formula">${inline(t)}</div>`;
}

// ---------- 插图：内联 SVG，缺则回落 PNG ----------
function figureHtml(b, pageDir) {
  const png = path.join(pageDir, b.file);
  const svg = png.replace(/\.png$/i, ".svg");
  const label = esc(b.label || "插图");
  let inner;
  if (fs.existsSync(svg)) {
    // 去掉固定 width/height，让它按容器缩放
    inner = fs.readFileSync(svg, "utf8")
      .replace(/\s(width|height)="[^"]*"/g, "")
      .replace("<svg ", '<svg class="fig-svg" ');
  } else if (fs.existsSync(png)) {
    const b64 = fs.readFileSync(png).toString("base64");
    inner = `<img class="fig-svg" alt="${label}" src="data:image/png;base64,${b64}">`;
  } else {
    inner = `<div class="missing">缺插图文件：${esc(b.file)}</div>`;
  }
  const kind = b.figure_kind === "table" ? " figure--table" : "";
  // 图题已烙在裁切图内，不再重复输出可见 figcaption，只作无障碍标签
  return `<figure class="figure${kind}" role="img" aria-label="${label}">${inner}</figure>`;
}

function problemHtml(b) {
  const items = (b.items || []).map(
    (it) => `<li class="item"><span class="key">${esc(it.key)})</span>` +
            `<span class="item-body">${inline(it.text)}</span></li>`).join("");
  return `<div class="problem">
    <p class="stem"><span class="pnum">${esc(String(b.number))}.</span> ${inline(b.stem)}</p>
    ${items ? `<ol class="items">${items}</ol>` : ""}
  </div>`;
}

function blockHtml(b, pageDir, skipped) {
  // 半截表格/插图：下半截不渲染
  if (b.type === "figure" && b.cont_from_prev_page === true) {
    skipped.push({ id: b.id, reason: "跨页图/表的下半截，已在起始页渲染" });
    return "";
  }
  switch (b.type) {
    case "heading":       return `<h2 class="heading">${inline(b.text)}</h2>`;
    case "paragraph":     return `<p class="para">${inline(b.text)}</p>`;
    case "formula_block": return blockMath(b.text);
    case "figure":        return figureHtml(b, pageDir);
    case "problem":       return problemHtml(b);
    case "answer":        return `<p class="answer">${inline(b.text)}</p>`;
    case "note":          return `<p class="note">${inline(b.text)}</p>`;
    case "toc_entry":
      return `<div class="toc lvl${b.level}"><span class="toc-title">${inline(b.title)}</span>` +
             `<span class="toc-dots"></span><span class="toc-page">${esc(String(b.page_ref ?? ""))}</span></div>`;
    default:              return "";
  }
}

// ---------- 页面 ----------
function render(doc, pageDir) {
  const skipped = [];
  const flow = doc.blocks.filter((b) => b.in_reading_flow !== false);
  const footer = doc.blocks.find((b) => b.type === "page_footer");
  const header = doc.blocks.find((b) => b.type === "page_header");
  const body = flow.map((b) => blockHtml(b, pageDir, skipped)).filter(Boolean).join("\n");

  const cont = [];
  if (doc.flags?.starts_mid_sentence) cont.push("承接上页");
  if (doc.flags?.ends_mid_sentence) cont.push("续下页");

  const title = `${doc.book_id} p.${String(doc.page).padStart(4, "0")}` +
                (doc.printed_page != null ? `（印刷页 ${doc.printed_page}）` : "");

  return { skipped, html: `<!DOCTYPE html>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
${katexCss()}
:root{ --ink:#1a1a1a; --page:#fdfcf9; --rule:#d8d3c8; }
*{box-sizing:border-box}
body{margin:0;padding:28px 16px;background:#eceae4;color:var(--ink);
  font-family:"Songti SC","Source Han Serif SC","Noto Serif CJK SC",SimSun,"STSong",serif;}
.sheet{max-width:44em;margin:0 auto;background:var(--page);padding:3.2em 3.4em 2.2em;
  box-shadow:0 1px 3px rgba(0,0,0,.14),0 10px 30px rgba(0,0,0,.07);border-radius:2px;}
.meta{max-width:44em;margin:0 auto 10px;font-size:12px;color:#6b6558;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;display:flex;gap:14px;flex-wrap:wrap}
.meta .tag{background:#fff;border:1px solid var(--rule);border-radius:3px;padding:1px 7px}
.para{margin:0 0 .18em;text-indent:2em;line-height:1.95;font-size:17.5px;text-align:justify}
.heading{font-size:20px;margin:1.1em 0 .5em;text-align:center;font-weight:700}
.formula{margin:.85em 0;text-align:center;font-size:17px}
.formula .katex-display{margin:0}
.figure{margin:1.15em 0;text-align:center}
.fig-svg{max-width:100%;height:auto;color:var(--ink)}
.figure--table .fig-svg{max-width:96%}
.problem{margin:1.05em 0 .5em}
.stem{margin:0 0 .3em;text-indent:0;line-height:1.9;font-size:17.5px}
.pnum{font-weight:700;margin-right:.35em}
.items{list-style:none;margin:.1em 0 0;padding:0 0 0 2.2em;
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.42em 1.6em}
.item{display:flex;gap:.5em;align-items:baseline;line-height:1.85;font-size:17px}
.key{min-width:1.5em}
.nb{white-space:nowrap}
.toc{display:flex;align-items:baseline;gap:.4em;line-height:2}
.toc-dots{flex:1;border-bottom:1px dotted #9a927f;transform:translateY(-.28em)}
.lvl2{padding-left:1.4em}.lvl3{padding-left:2.8em}
.answer,.note{margin:.4em 0;line-height:1.9;font-size:16.5px}
.pagefoot{margin-top:2.4em;padding-top:.7em;border-top:1px solid var(--rule);
  text-align:center;font-size:14px;color:#6b6558;letter-spacing:.12em}
.pagehead{text-align:center;font-size:14px;color:#6b6558;margin-bottom:1.4em}
.missing,.tex-error{color:#a3341f;background:#fdeeea;padding:1px 5px;border-radius:3px}
.skipped{max-width:44em;margin:10px auto 0;font-size:12px;color:#7a6a52;
  font-family:ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){
  :root{--ink:#e8e4da;--page:#1c1b19;--rule:#3a372f}
  body{background:#121211}
  .meta,.pagefoot,.pagehead{color:#9a9384}
  .meta .tag{background:#232220}
}
@media (max-width:640px){ .sheet{padding:2em 1.3em} .items{grid-template-columns:1fr} }
</style>
<div class="meta">
  <span class="tag">${esc(doc.book_id)}</span>
  <span class="tag">PDF 页 ${doc.page}</span>
  ${doc.printed_page != null ? `<span class="tag">印刷页 ${esc(String(doc.printed_page))}</span>` : ""}
  <span class="tag">${flow.length} blocks</span>
  ${cont.length ? `<span class="tag">${cont.join(" · ")}</span>` : ""}
  <span class="tag">${esc(doc.schema)}</span>
</div>
<article class="sheet">
${header ? `<div class="pagehead">${esc(header.text)}</div>` : ""}
${body}
${footer ? `<div class="pagefoot">${esc(footer.text)}</div>` : ""}
</article>
${skipped.length ? `<div class="skipped">已跳过 ${skipped.length} 块：` +
  skipped.map((s) => `${s.id}（${s.reason}）`).join("；") + `</div>` : ""}
` };
}

module.exports = { katexCss, inline, blockMath, figureHtml, problemHtml, blockHtml, esc, render };

if (require.main !== module) return;

const [, , inJson, outHtml] = process.argv;
if (!inJson || !outHtml) {
  console.error("用法: render_page.js <page.json|meta.json> <out.html>");
  process.exit(2);
}
const doc = JSON.parse(fs.readFileSync(inJson, "utf8"));
// 插图始终存放在 cap1 的 pages/ 目录下；渲染 stitched/ 的 meta.json 时要回指过去
let pageDir = path.dirname(path.resolve(inJson));
if (process.argv[4]) {
  pageDir = path.resolve(process.argv[4]);
} else if (pageDir.includes(`${path.sep}stitched${path.sep}`)) {
  pageDir = pageDir.replace(`${path.sep}stitched${path.sep}`, `${path.sep}pages${path.sep}`);
}
const { html, skipped } = render(doc, pageDir);
fs.mkdirSync(path.dirname(path.resolve(outHtml)), { recursive: true });
fs.writeFileSync(outHtml, html);
console.log(JSON.stringify({
  ok: true, out: outHtml, blocks: doc.blocks.length,
  rendered: doc.blocks.filter((b) => b.in_reading_flow !== false).length,
  skipped, bytes: Buffer.byteLength(html),
}, null, 2));
