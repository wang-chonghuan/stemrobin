#!/usr/bin/env node
/**
 * 用 KaTeX 解析每条公式。
 *
 * 关键点：校验用的引擎 = 将来 HTML 渲染用的引擎。cap1 通过即保证网页渲得出来，
 * 而不是"看起来像 LaTeX"。
 *
 * stdin : [{id, field, tex, display}]
 * stdout: [{id, field, ok, error?, warnings?}]
 */
const katex = require("katex");

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let items;
  try {
    items = JSON.parse(raw || "[]");
  } catch (e) {
    console.log(JSON.stringify([{ fatal: `stdin 不是合法 JSON: ${e.message}` }]));
    return;
  }
  const out = items.map((it) => {
    const warnings = [];
    try {
      katex.renderToString(it.tex, {
        displayMode: !!it.display,
        throwOnError: true,
        strict: (code, msg) => {
          // unicodeTextInMathMode 等问题必须暴露：它们正是"看着对、渲染歪"的来源
          warnings.push(`${code}: ${msg}`);
          return "ignore";
        },
        trust: false,
      });
      return { id: it.id, field: it.field, ok: true, warnings };
    } catch (e) {
      return {
        id: it.id,
        field: it.field,
        ok: false,
        error: String(e.message || e).replace(/\s+/g, " ").slice(0, 240),
        warnings,
      };
    }
  });
  console.log(JSON.stringify(out));
});
