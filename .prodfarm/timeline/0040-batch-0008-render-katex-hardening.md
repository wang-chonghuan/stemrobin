# 0040 batch 0008-render-katex-hardening
- kind: batch
- batch: 0008-render-katex-hardening
- charter_commit: 本 boundary 直推 main（仅 .prodfarm 立批归档）
## Decisions and rationale
seed STEMROBIN-45（full delegation，人指定交付集）：根治 3.9 两处渲染乱码。根因（实测）：render-lesson.mjs 用 String.replace 字符串替换注入模板，esc() 把 `$>$`→`$&gt;`，`$&` 被 JS 当「整段匹配」渲成 `{{SECTIONS}}gt;`（乱码 B）；课文正文原样输出，裸 `$2<x$` 的 `<x` 被浏览器当标签吞后文（乱码 A）。定调：fix 改函数替换 + 加「$…$ 内 `<` 紧跟字母」校验（根治+防复发）；chore 改 3.9 例3 为 `$2 \lt x$`、扫三课、重存。2 单 DAG 46→47。风险低。
## Deferred
- 既有 16 课若被乱码 B 波及，开发时扫查并在报告注明，按需另议（不默认扩范围）。
## Veto handling
none。
## Charter changes
无。仅 .prodfarm 立批归档直推 main。
