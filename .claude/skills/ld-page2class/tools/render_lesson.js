#!/usr/bin/env node
/**
 * cap4：每个小节出两张自包含 HTML —— 课文页 + 习题页，白底。
 *
 * 自包含 = 不依赖网络也不依赖同级文件：KaTeX 服务端渲染成静态 HTML（页面不需要
 * JS），KaTeX 的 CSS 与 woff2 字体以 data URI 内联，插图 SVG 直接内联。
 *
 * 坑：katex.min.css 里 src 是 @font-face 的最后一条声明，以 } 结尾而非 ;。
 * 按 ; 匹配会一个字体都替换不到，页面看着能用（系统字体兜底）但并不自包含。
 * 所以内联数为 0 直接抛错，不允许静默降级。
 *
 * 用法: render_lesson.js <bookDir> [lessonId]
 */
const fs = require("fs");
const path = require("path");
const katex = require("katex");

const SKILL = path.resolve(__dirname, "..");
const KATEX_DIST = path.join(SKILL, "node_modules", "katex", "dist");
const [, , bookDir, onlyLesson] = process.argv;
if (!bookDir) { console.error("用法: render_lesson.js <bookDir> [lessonId]"); process.exit(2); }

function katexCss() {
  let css = fs.readFileSync(path.join(KATEX_DIST, "katex.min.css"), "utf8");
  let n = 0;
  css = css.replace(/src:[^;}]*(?=[;}])/g, (src) => {
    const m = src.match(/url\(fonts\/(KaTeX_[\w-]+)\.woff2\)/);
    if (!m) return src;
    const f = path.join(KATEX_DIST, "fonts", `${m[1]}.woff2`);
    if (!fs.existsSync(f)) return src;
    n += 1;
    return `src:url(data:font/woff2;base64,${fs.readFileSync(f).toString("base64")}) format('woff2')`;
  });
  if (n === 0) throw new Error("KaTeX 字体一个都没内联成功——HTML 不会是自包含的");
  return css;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// 原书用黑体排定义句，转写时记成 **…**，这里还原成 <strong>
const strong = (h) => h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
const MATH = /\$\$(.+?)\$\$|\$([^$]+?)\$/gs;
// 公式后面紧跟的标点必须与公式绑在一起，否则 `$…$;` 的分号会被甩到下一行
const TRAIL = /^[;,.、，。：:！!？?)）\]]+/;

function inline(text) {
  let out = "", last = 0;
  for (const m of text.matchAll(MATH)) {
    out += esc(text.slice(last, m.index));
    const tex = m[1] ?? m[2];
    let html;
    try {
      html = katex.renderToString(tex, { displayMode: !!m[1], throwOnError: false });
    } catch (e) { html = `<span class="err">${esc(tex)}</span>`; }
    last = m.index + m[0].length;
    const t = (text.slice(last).match(TRAIL) || [""])[0];
    last += t.length;
    out += `<span class="nb">${html}${esc(t)}</span>`;
  }
  return strong(out + esc(text.slice(last)));
}

function figure(book, id, label) {
  const svg = path.join(book, "figures", `${id}.svg`);
  const png = path.join(book, "figures", `${id}.png`);
  if (fs.existsSync(svg)) {
    return `<figure class="fig" id="${id}" aria-label="${esc(label || id)}">`
      + fs.readFileSync(svg, "utf8").replace(/<\?xml[^>]*\?>/, "") + `</figure>`;
  }
  if (fs.existsSync(png)) {
    const b64 = fs.readFileSync(png).toString("base64");
    return `<figure class="fig" id="${id}"><img alt="${esc(label || id)}" `
      + `src="data:image/png;base64,${b64}"></figure>`;
  }
  return `<p class="err">缺图 ${esc(id)}</p>`;
}

const CSS = `
${katexCss()}
:root{--ink:#1b1b1b;--sub:#6b6b6b;--rule:#e3e3e3;--accent:#2b5f8e}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);
  font-family:"Songti SC","Source Han Serif SC","Noto Serif CJK SC",SimSun,serif}
.sheet{max-width:46em;margin:0 auto;padding:2.4em 1.6em 5em}
h1{font-size:1.6em;margin:0 0 .2em;letter-spacing:.02em}
.crumb{color:var(--sub);font-size:.82em;margin:0 0 2em;
  font-family:ui-monospace,Menlo,monospace}
p.para{margin:0 0 .2em;text-indent:2em;line-height:1.95;font-size:1.06em;text-align:justify}
.figcap{text-align:center;color:var(--sub);font-size:.85em;margin:.2em 0 1.2em}
.fig{margin:1.3em 0 .2em;text-align:center}
.fig svg{max-width:min(100%,26em);height:auto;color:var(--ink)}
.fig img{max-width:min(100%,26em);height:auto}
.nb{white-space:nowrap}
.err{color:#a3341f;background:#fdeeea;padding:1px 5px;border-radius:3px}
.exgroup{margin:2.2em 0 .8em;font-weight:700;font-size:1.05em;
  border-left:3px solid var(--accent);padding-left:.6em}
ol.ex{list-style:none;margin:0;padding:0;counter-reset:none}
li.ex{display:grid;grid-template-columns:3.2em 1fr;gap:.2em .4em;
  padding:.85em 0;border-top:1px solid var(--rule)}
li.ex .no{font-family:ui-monospace,Menlo,monospace;color:var(--accent);
  font-weight:700;padding-top:.15em}
li.ex .body{min-width:0;overflow-x:auto;line-height:1.9;font-size:1.04em}
li.ex .body .fig{margin:.7em 0 0;text-align:left}
li.ex .body .fig svg,li.ex .body img{max-width:min(100%,18em)}
.jump{display:inline-block;margin:2.5em 0 0;padding:.55em 1.1em;border-radius:6px;
  background:var(--accent);color:#fff;text-decoration:none;font-size:.95em}
.src{color:var(--sub);font-size:.78em;font-family:ui-monospace,Menlo,monospace}
@media (max-width:640px){.sheet{padding:1.4em 1em 4em}li.ex{grid-template-columns:2.6em 1fr}}
`;

function page(title, crumb, bodyHtml) {
  return `<!DOCTYPE html><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${CSS}</style><div class="sheet"><h1>${esc(title)}</h1>
<div class="crumb">${esc(crumb)}</div>${bodyHtml}</div>`;
}

const book = path.resolve(bookDir);
const lessonDirs = fs.readdirSync(path.join(book, "lessons"))
  .filter((d) => !onlyLesson || d === onlyLesson).sort();
const done = [];

for (const lid of lessonDirs) {
  const dir = path.join(book, "lessons", lid);
  const L = JSON.parse(fs.readFileSync(path.join(dir, "lesson.json"), "utf8"));
  const X = JSON.parse(fs.readFileSync(path.join(dir, "exercises.json"), "utf8"));
  const crumb = [L.chapter, L.section, `印刷页 ${L.start_printed ?? "?"}`]
    .filter(Boolean).join(" · ");

  // ---- 课文页
  let body = "";
  for (const b of L.prose) {
    if (b.kind === "fig") body += figure(book, b.id, b.label);
    else if (b.kind === "cap") body += `<div class="figcap">${inline(b.text)}</div>`;
    else body += `<p class="para">${inline(b.text)}</p>`;
  }
  body += `<a class="jump" href="exercises.html">去做题 · ${X.count} 道 →</a>`;
  fs.writeFileSync(path.join(dir, "text.html"),
    page(L.printed_title || L.title, crumb, body));

  // ---- 习题页：每题独立编号，带自己的图
  let group = null, out = "";
  for (const e of X.exercises) {
    if (e.group !== group) {
      if (out) out += "</ol>";
      group = e.group;
      out += `<div class="exgroup">${esc(group || "练习")}</div><ol class="ex">`;
    }
    const figs = (e.figures || []).map((f) => figure(book, f.id, f.label)).join("");
    out += `<li class="ex" id="ex-${esc(e.number)}"><div class="no">${esc(e.number)}.</div>`
      + `<div class="body">${inline(e.text)}${figs}</div></li>`;
  }
  if (out) out += "</ol>";
  out += `<a class="jump" href="text.html">← 回课文</a>`;
  fs.writeFileSync(path.join(dir, "exercises.html"),
    page(`${L.printed_title || L.title} · 习题`, crumb, out));
  done.push({ lesson: lid, exercises: X.count, prose: L.prose.length });
}

console.log(JSON.stringify({ ok: true, lessons: done }, null, 2));
