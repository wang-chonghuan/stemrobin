const assert = require("node:assert/strict")
const { inline } = require("../tools/htmlfrag.js")

const html = inline("题目：\n1) $x+1$；\n2) $x+2$.")
assert.match(html, /题目：<br>1\)/)
assert.match(html, /；<br>2\)/)
