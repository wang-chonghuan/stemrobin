#!/usr/bin/env node
/**
 * 用 resvg 把 SVG 栅格化成 PNG，供 cap4 的保真自检比对。
 *
 * 与 KaTeX 校验同一思路：用真正的渲染引擎验证，而不是自己近似模拟。
 * 自造的栅格化器只能证明"我的近似和我的近似一致"。
 *
 * argv: <in.svg> <out.png> [width]
 */
const fs = require("fs");
const { Resvg } = require("@resvg/resvg-js");

const [, , inSvg, outPng, widthArg] = process.argv;
if (!inSvg || !outPng) {
  console.error("用法: svg_raster.js <in.svg> <out.png> [width]");
  process.exit(2);
}

try {
  const svg = fs.readFileSync(inSvg, "utf8");
  const opts = { background: "white" };
  if (widthArg) opts.fitTo = { mode: "width", value: parseInt(widthArg, 10) };
  const r = new Resvg(svg, opts);
  const png = r.render();
  fs.writeFileSync(outPng, png.asPng());
  console.log(JSON.stringify({ ok: true, w: png.width, h: png.height }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e.message || e) }));
  process.exit(1);
}
