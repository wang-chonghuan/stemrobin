# STEMROBIN-124 · ac

## AC1 · 用内容技能保存一篇课文后，该课立刻出现在产品的英语目录里，并能打开阅读

**怎么查**：起 dev server（52124），用 `save-lesson.mjs` 保存 `english-u02-08`，然后用测试账号
cookie 打开 playwright，看侧栏「技术英语」的条目里有没有 *Crossing the Road*，点开课文页能不能读到
首句和它的中文。

**判定为真**：目录里出现该课，课文页显示 `Do not walk into the road.` 与「别走到马路上去」。
（此前正是这一步显示「课文暂不可用」。）

## AC2 · `coverage.mjs` 报出的课文数与产品目录里看到的篇数一致

**怎么查**：`node .agents/skills/sr-voa1500/scripts/coverage.mjs` 的「课文数」，对比 playwright 在
侧栏数到的英语条目数。

**判定为真**：两个数字相等。

## AC3 · 仓库里搜不到任何仍然写向 `stemrobin-schema` 的写入路径

**怎么查**：`grep -rn "stemrobin-schema" .agents ssot-schemas app`（排除 node_modules）。

**判定为真**：没有任何**可执行代码**再引用它；只允许在说明「它已退役」的散文里出现。

## AC4 · DDL SSOT 文件描述的表与列，和线上 schema 实际拥有的一致

**怎么查**：一段脚本，把 SSOT DDL 里声明的表名/列名与 `information_schema` 里
`lemmadeck-schema` 的实际表名/列名对拍。

**判定为真**：两边的表集合与每张表的列集合完全相同，脚本退出码 0。
