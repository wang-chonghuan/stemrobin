# Batch 0007-reading-polish — grill 归档
来源：released cap8 seed STEMROBIN-39。机器调查 + 定调即 grill 记录。
## Release gate
- full delegation → 已放行，3 张立批。
## 机器调查 + 定调
- 根因：全文速览用自建 buildFullTextHtml（section 无编号、简陋 ol），PDF 用 skill render-lesson.mjs（sr-sec-num+sr-sec-name+sr-practice 精美模板）——两渲染器。
- G-A：速览改用 skill 渲染 html（PDF 同款），配套从 JSONB 重渲 16 课 html/pdf（STEMROBIN-34 遗留）。
- G-B：卡片精读 section 标题显示编号+名 + 换色。
- G-C：render-lesson.mjs 有可打磨处则打磨（编号/样式/练习区），确保重渲美观、section 带序号。
