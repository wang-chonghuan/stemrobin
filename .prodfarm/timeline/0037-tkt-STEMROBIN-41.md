# 0037 tkt STEMROBIN-41
- kind: tkt
- ticket: STEMROBIN-41
- type: story
- batch: 0007-reading-polish
- merge_commit: 0db139a
- seed: STEMROBIN-39
## 摘要
全文速览改用 skill 渲染 html（seed G-A）：速览改渲染存量 sr_lessons.html(= PDF 同款渲染器，编号 section+样式化练习)，删掉重复的 buildFullTextHtml/exercisesHtml(一个渲染器)。html 练习区为 prompt-only 无 KEY→速览课后题自动 display-only(满足 G-3)。cap9：速览 .sr-sec-num=6、首'1 为什么学这个'、练习区样式化、0 按钮/输入、无 KEY、263 katex、移动无溢出、64 单测；生产验证速览=PDF 品质。改 app→已重部署 rev 0000031。无 grill-leak。
