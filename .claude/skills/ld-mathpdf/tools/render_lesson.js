#!/usr/bin/env node
/**
 * cap5b：把连续多页拼成一篇「课文」，左侧带可点的目录。
 *
 * 目录来自教材自己的 TOC JSON（ssot-resources/.../toc/<book>/<locale>.json），
 * 只取覆盖到的那些小节；点击目录项跳到该小节在正文中的位置。
 * 小节的定位靠正文里的 heading 块——它们就是原书印的小节标题，不另建映射。
 *
 * 用法: render_lesson.js <out.html> <toc.json> <sectionId> <page1.json> [page2.json ...]
 */
const fs = require("fs");
const path = require("path");
const R = require("./render_page.js");

// --bare：不输出左侧目录栏，只出课文正文（供宿主应用嵌入，宿主自己有目录）
const argv = process.argv.filter((a) => a !== "--bare");
const BARE = process.argv.includes("--bare");
const [, , outHtml, tocPath, sectionId, ...pageJsons] = argv;
if (!outHtml || !tocPath || !sectionId || !pageJsons.length) {
  console.error("用法: render_lesson.js <out.html> <toc.json> <sectionId> <page.json...>");
  process.exit(2);
}

const toc = JSON.parse(fs.readFileSync(tocPath, "utf8"));
let chapter = null, section = null;
for (const c of toc.contents || []) {
  for (const l of c.lessons || []) {
    if (l.id === sectionId) { chapter = c; section = l; }
  }
}
if (!section) { console.error(`TOC 里找不到 ${sectionId}`); process.exit(2); }

const docs = pageJsons.map((p) => {
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  let dir = path.dirname(path.resolve(p));
  if (dir.includes(`${path.sep}stitched${path.sep}`)) {
    dir = dir.replace(`${path.sep}stitched${path.sep}`, `${path.sep}pages${path.sep}`);
  }
  return { doc, dir };
});
docs.sort((a, b) => a.doc.page - b.doc.page);

const printed = docs.map((d) => d.doc.printed_page).filter((x) => x != null);
const coverage = printed.length ? [Math.min(...printed), Math.max(...printed)] : null;

// 覆盖到的小节 = 起始页落在本次页码范围内的那些
const topics = (section.topics || []).filter(
  (t) => coverage && t.page >= coverage[0] && t.page <= coverage[1]);

// 正文：按页顺序铺开；heading 块打上锚点，供目录跳转
const skipped = [];
let anchorIdx = 0;
const anchorOf = new Map();          // 小节标题文字 → 锚点 id
for (const t of topics) anchorOf.set(t.title.replace(/\s+/g, ""), `topic-${t.printedNumber}`);

const body = docs.map(({ doc, dir }) => {
  const flow = doc.blocks.filter((b) => b.in_reading_flow !== false);
  const inner = flow.map((b) => {
    let html = R.blockHtml(b, dir, skipped);
    if (!html) return "";
    if (b.type === "heading") {
      // 原书小节标题形如「1. 子集」；去掉编号与空白后与目录条目对齐
      const key = (b.text || "").replace(/^\s*\d+\s*[.．、]\s*/, "").replace(/\s+/g, "");
      const id = anchorOf.get(key);
      if (id) html = html.replace("<h2 ", `<h2 id="${id}" `);
    }
    return html;
  }).filter(Boolean).join("\n");
  const foot = doc.blocks.find((b) => b.type === "page_footer");
  return `<section class="pg" data-page="${doc.page}">
${inner}
${foot ? `<div class="pagefoot">${R.esc(foot.text)}</div>` : ""}
</section>`;
}).join("\n");

const tocHtml = topics.map((t) => {
  const inScope = anchorOf.has(t.title.replace(/\s+/g, ""));
  return inScope
    ? `<li><a href="#topic-${t.printedNumber}"><span class="n">${t.printedNumber}</span>` +
      `<span class="tt">${R.esc(t.title)}</span><span class="pp">${t.page}</span></a></li>`
    : `<li class="off"><span class="n">${t.printedNumber}</span>` +
      `<span class="tt">${R.esc(t.title)}</span><span class="pp">${t.page}</span></li>`;
}).join("");

const allTopics = (section.topics || []).map((t) => {
  const on = topics.some((x) => x.id === t.id);
  return on
    ? `<li><a href="#topic-${t.printedNumber}"><span class="n">${t.printedNumber}</span>` +
      `<span class="tt">${R.esc(t.title)}</span><span class="pp">${t.page}</span></a></li>`
    : `<li class="off" title="本次未转写"><span class="n">${t.printedNumber}</span>` +
      `<span class="tt">${R.esc(t.title)}</span><span class="pp">${t.page}</span></li>`;
}).join("");

const title = `${toc.title} · ${section.number} ${section.title}`;

const html = `<!DOCTYPE html>
<meta charset="utf-8">
<title>${R.esc(title)}</title>
<style>
${R.katexCss()}
:root{--ink:#1a1a1a;--page:#fdfcf9;--rule:#ded9cd;--rail:#f4f2ec;--accent:#1f6f8b}
*{box-sizing:border-box}
body{margin:0;background:#eceae4;color:var(--ink);
  font-family:"Songti SC","Source Han Serif SC","Noto Serif CJK SC",SimSun,serif}
.wrap{display:grid;grid-template-columns:262px minmax(0,1fr);min-height:100vh}
.rail{background:var(--rail);border-right:1px solid var(--rule);padding:20px 0 40px;
  position:sticky;top:0;height:100vh;overflow:auto}
.rail h1{font-size:14px;margin:0 18px 2px;letter-spacing:.02em}
.rail .sub{font-size:12px;color:#7c7462;margin:0 18px 14px;
  font-family:ui-monospace,Menlo,monospace}
.rail h2{font-size:12.5px;color:#7c7462;margin:16px 18px 6px;font-weight:600;
  text-transform:none;letter-spacing:.04em}
.rail ol{list-style:none;margin:0;padding:0}
.rail li{font-size:13.5px}
.rail a,.rail li.off{display:grid;grid-template-columns:22px 1fr auto;gap:8px;
  align-items:baseline;padding:6px 18px;color:inherit;text-decoration:none;line-height:1.5}
.rail a:hover{background:#e7e3d8}
.rail a:target,.rail a.cur{background:#dfeaef}
.rail li.off{color:#a8a191}
.rail .n{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:#8d8straight}
.rail .n{color:#8d8straight}
.rail .n{color:#8d8674}
.rail .pp{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#a8a191}
.main{padding:26px 20px 70px}
.sheet{max-width:44em;margin:0 auto;background:var(--page);
  padding:2.6em 3.2em;box-shadow:0 1px 3px rgba(0,0,0,.13),0 10px 30px rgba(0,0,0,.06)}
.crumb{max-width:44em;margin:0 auto 12px;font-size:12px;color:#6b6558;
  font-family:ui-monospace,Menlo,monospace}
.pg{padding-bottom:.4em}
.pg + .pg{border-top:1px dashed var(--rule);margin-top:1.6em;padding-top:1.4em}
.para{margin:0 0 .18em;text-indent:2em;line-height:1.95;font-size:17.5px;text-align:justify}
.heading{font-size:19px;margin:1.15em 0 .55em;font-weight:700;scroll-margin-top:18px}
h2.heading[id]{border-left:3px solid var(--accent);padding-left:.55em}
.formula{margin:.85em 0;text-align:center;font-size:17px}
.formula .katex-display{margin:0}
.figure{margin:1.15em 0;text-align:center}
.fig-svg{max-width:100%;height:auto;color:var(--ink)}
.problem{margin:1.05em 0 .5em}
.stem{margin:0 0 .3em;text-indent:0;line-height:1.9;font-size:17.5px}
.pnum{font-weight:700;margin-right:.35em}
.items{list-style:none;margin:.1em 0 0;padding:0 0 0 2.2em;
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.42em 1.6em}
.item{display:flex;gap:.5em;align-items:baseline;line-height:1.85;font-size:17px}
.key{min-width:1.5em}
.nb{white-space:nowrap}
.answer,.note{margin:.4em 0;line-height:1.9;font-size:16.5px}
.pagefoot{margin-top:1.1em;text-align:center;font-size:13px;color:#8d8674;letter-spacing:.12em}
.missing,.tex-error{color:#a3341f;background:#fdeeea;padding:1px 5px;border-radius:3px}
@media (prefers-color-scheme:dark){
  :root{--ink:#e8e4da;--page:#1c1b19;--rule:#3a372f;--rail:#181715}
  body{background:#121211}
  .rail a:hover{background:#232220}.rail a.cur{background:#26312f}
  .crumb,.pagefoot{color:#9a9384}
}
@media (max-width:860px){.wrap{grid-template-columns:1fr}.rail{position:static;height:auto}}
</style>
${BARE ? `<div class="main bare"><article class="sheet">${body}</article></div>`
  : `<div class="wrap">
  <nav class="rail">
    <h1>${R.esc(toc.title)}</h1>
    <div class="sub">${R.esc(toc.book)} · ${R.esc(chapter.title)}</div>
    <h2>${R.esc(section.number)} ${R.esc(section.title)}</h2>
    <ol>${allTopics}</ol>
  </nav>
  <div class="main">
    <div class="crumb">已转写 PDF 页 ${docs[0].doc.page}–${docs[docs.length - 1].doc.page}
      · 印刷页 ${coverage ? coverage.join("–") : "?"} · ${docs.length} 页 ·
      灰色目录项尚未转写</div>
    <article class="sheet">${body}</article>
  </div>
</div>`}
<style>.main.bare{padding:0;background:transparent}
.main.bare .sheet{box-shadow:none;max-width:none;padding:1.6em 1.9em;background:transparent}</style>
<script>
// 目录高亮跟随阅读位置
const links=[...document.querySelectorAll('.rail a')];
const targets=links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
addEventListener('scroll',()=>{
  let cur=0;
  targets.forEach((t,i)=>{ if(t.getBoundingClientRect().top<120) cur=i; });
  links.forEach(a=>a.classList.remove('cur'));
  if(links[cur]) links[cur].classList.add('cur');
},{passive:true});
</script>
`;

fs.mkdirSync(path.dirname(path.resolve(outHtml)), { recursive: true });
fs.writeFileSync(outHtml, html);
console.log(JSON.stringify({
  ok: true, out: outHtml, pages: docs.length,
  printedRange: coverage, topicsLinked: topics.length,
  topicsTotal: (section.topics || []).length, skipped,
  bytes: Buffer.byteLength(html),
}, null, 2));
