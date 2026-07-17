# Batch 0008-render-katex-hardening — report

Seed：STEMROBIN-45（human, full delegation）。1 seed = 1 batch。2 单，全部 done。

## 交付
- **STEMROBIN-46（fix）** merge b55984d：根治 render-lesson 的 `$&`/`{{SECTIONS}}` 替换乱码（改函数替换）+ 加「正文 `$…$` 内裸 `<字母`」校验守卫（提示 `\lt`，只作用于原样输出的正文，不误伤转义的题干/算符）。
- **STEMROBIN-47（chore）**：用修好的渲染器/守卫修复并重存 3.9/3.10/3.11。守卫揪出三课正文共 **14** 处裸 `<字母`（3.9×3、3.10×3、3.11×8，远超肉眼可见的例3），逐处改 `\lt` 后重存（重渲 html/pdf + 重派生 sr_questions）。

## 验收（实测）
- 单测：`$2<x$`→HAZARD；`$>$`/`$<$`/`$a < b$`/`$x<3$`→放行。
- 渲染：三课 stored html `{{…}}` 泄漏=0；3.9 例3 = `例 3　$2 \lt x$（未知数写在右边）`、练习 q1 = `$&gt;$、$&lt;$…统称什么？`。
- 浏览器（登录测试号，全文速览）：三课 placeholderLeak=false、KaTeX 正常（180/317/257 节点）。
- 仅改 skill，app/ 未动、内容 DB 驱动 → 无需重部署，三课已在共享生产库生效。

## 遗留 / 注记
- 既有 16 课未在本 batch 触及；其正文若也有裸 `<字母` 会在下次重存时被新守卫拦下（未主动扫查，按需另开）。守卫已从源头防复发。
