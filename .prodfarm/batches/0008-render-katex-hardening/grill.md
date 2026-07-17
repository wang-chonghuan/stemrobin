# Batch 0008 grill（cap11 自裁，seed STEMROBIN-45）

seed 为人类发起、full delegation。机器调查结论经 cap11 自我拷问，均立于实测证据，无待人裁的产品决策，无 redline：

- **可行性（实测）**：两处乱码均在 render-lesson.mjs 渲出的 html 复现；overlay/sr_questions 源文本干净。乱码 B 精确对上 JS `String.replace` 的 `$&`（整段匹配=`{{SECTIONS}}`）语义 + esc() 把 `>`→`&gt;`；乱码 A 对上课文正文原样输出时裸 `<字母` 破坏 HTML 解析。
- **一致性**：函数替换消除 `$` 特殊串是标准做法，不改变正常注入语义；新校验只针对「`<`紧跟字母」，不误伤 `$>$`/`$<$`/`$a < b$`。
- **完整性**：fix 修根（渲染器+校验），chore 修数据（改 3.9 例3 + 扫三课 + 重存）。DAG 46→47。既有 16 课是否被乱码 B 波及，在开发时顺带扫查并在报告注明（不默认扩范围）。
- **批次风险**：低。仅改 skill 渲染/校验 + 三课数据；app/ 未动，内容 DB 驱动 → 无需重部署。

裁决：2 单（1 fix + 1 chore）成立，full delegation 直接开发。
