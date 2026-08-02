---
name: ld-s10y-lesson
description: 按书名、章、节、连续编号单元或页码，把纯扫描的教材 PDF 抽成课程单元——每个最小单元一份完整课文 + 一组独立编号的题；原始图忠实抽取，现代 edition 图委托项目技能 ld-s10y-image 生成。正文图留正文，共享练习图只展示一次。用于无文字层的老教材数字化。
---

# ld-s10y-lesson

**扫描教材 PDF → 按单元成课、按题成件。**

适用判据：`pdffonts book.pdf` 无嵌入字体、`pdftotext` 提取 0 字符 → 该书没有文字层，
所有"抽取文字层"的工具都会输出空白，必须走视觉转写。

## 用户入口与术语

- **单元**是最小可发布内容项，对应 TOC 的 `topics[].printedNumber`；编号在全书连续，
  不是某一节内部重新从 1 数
- **章**对应 `contents[]`，**节**对应 `lessons[]`；它们用于辅助定位单元
- 书可用 book id 或书名；先在 `ssot-resources/soviet10year-textbooks/toc/` 找到唯一 TOC
- 支持「5m 第 8 单元」「5m 第 5–7 单元」「5m 第一章第一节第 5 单元」
  「5m 第一章『正数和负数』§1『集合的运算』第 5 单元『分类』」和直接给 PDF 页码
- 编号、层级和标题同时出现时要互相校验；能唯一定位就直接执行，只有冲突或不唯一时才问
- 从目标单元的 `page` 和下一单元的 `page` 推导印刷页范围，再按本书 PDF 偏移换成物理页；
  为闭合跨页正文或习题，可以向前后多取边界页，但只发布已完整的目标单元

## 抽一批页的标准流程

用户通常只会给一句话：**「抽 5m 第 21–31 页」**或**「抽完 5、6、7 单元」**。
这句话同时授权把指定且已完整的单元 upsert 到生产内容库。默认按下面整套走到底，
直到产品中实际可见，不要停在中间：

```bash
P=.claude/skills/ld-s10y-lesson/.venv/bin/python
S=.claude/skills/ld-s10y-lesson/tools/p2c.py

for n in $(seq 21 31); do $P $S prepare --book 5m --page $n; done   # ① 备料
#   ② 逐页读 page.grid.png，把 page.template.md 填成 page.md
for n in $(seq 21 31); do $P $S finalize --book 5m --page $n; done  # ③ 收口，必须全绿

$P $S assemble  --book 5m --toc ssot-resources/soviet10year-textbooks/toc/5m/zh.json
$P $S vectorize --book 5m
$P $S assemble  --book 5m --toc ssot-resources/soviet10year-textbooks/toc/5m/zh.json
$P $S adapt-prepare --book 5m --edition modern-us-neutral \
  --lesson math5-c1-s1-n5 --lesson math5-c1-s1-n6 --lesson math5-c1-s1-n7
# ④ 只编辑 editions/modern-us-neutral 下的模板，改写主题；
#    所有现代图委托 ld-s10y-image，按 deterministic / hybrid / generated 路由
$P $S adapt-finalize --book 5m --edition modern-us-neutral \
  --lesson math5-c1-s1-n5 --lesson math5-c1-s1-n6 --lesson math5-c1-s1-n7
$P $S render --book 5m --edition modern-us-neutral \
  --lesson math5-c1-s1-n5 --lesson math5-c1-s1-n6 --lesson math5-c1-s1-n7
node .claude/skills/ld-s10y-lesson/tools/publish.mjs resources/s10y-lessons/5m \
  --edition modern-us-neutral \
  --lesson math5-c1-s1-n5 --lesson math5-c1-s1-n6 --lesson math5-c1-s1-n7
cd app && npm run dev
```

- `assemble` 的 `--toc` **不能省**：课的 id 是从教材目录认领的，没有它产品里就没有地址
- ③ 和 `assemble` 的对账**不通过就是没做完**，回到 ② 修，不允许放行
- `vectorize` 后必须再跑一次 `assemble`，把页目录中新生成的 SVG 同步到全书图库
- 原始 `pages/`、`figures/`、`lessons/` 和 `book.json` 是忠实抽取层，生成现代版时不得修改
- `adapt-prepare` 后只编辑 `editions/<edition>/`；改写后的 JSON 和新图必须通过
  `adapt-finalize`，生产发布器不接受原始抽取层
- `render` 不是发布门禁，但必须用于离线视觉检查；它读取指定 edition，不得回退原书
- 边界页常会带出下一节开头；它必须完整转写以通过页级对账，但**不得发布未完成的下一节**。
  用可重复的 `--lesson <cardId>` 只发布本次已完成的单元
- **不允许以 `--dry` 作为交付终点**。dry-run 只能用于发布前检查，之后必须真实写库
- 写库后查询 `sr_lessons` 核对目标 id 的正文块数和题数，再启动 app，用浏览器逐节确认
  目录可点、正文准确（原书无正文时允许为空）、插图清晰、习题数量正确、控制台无错误

## 交付的是对象，不是页

页是扫描的产物，不是内容的单位。要交付的两个对象——**单元**和**题**——都不认页
边界：一道题会跨页，一段课文会被插图从中间截断，一张图的引用可能在邻页。

所以整条管线围绕对象组织：cap1 认出对象并标好"是否续到下页"，cap2 按标记拼接。
**页级的东西只剩两样**：像素（裁图要它）和一条行数对账（页级唯一的完整性硬证据）。

## 分工：模型认对象，机器管像素

这是本技能最重要的一条，不要退回去。

纯机械的图/文判据（长横线、连通域高度、尺寸下限）试过并放弃了：每换一种版面就得
加一条规则，补了五轮仍在漏——图题被裁进插图、坐标轴被行带拦腰切断、页码被切成
三截、文字环绕的插图把整段题面烙进图里。

模型一眼就能看出哪块是插图、哪块是半张被撕掉的表、哪一段是第几题，**但给不出准确
像素坐标**。机器恰好相反。于是：

| 谁 | 干什么 |
|---|---|
| 模型（看图） | 认对象：这是插图/表/第几题/哪一节；画个**粗框**；判断是否续到下页 |
| 机器（确定性） | 把粗框**吸附**到连通域上、裁图、矢量化、跨页拼接、全书对账 |

吸附实测：粗框 `[780,1630,510,270]` → `[793,1643,488,244]`，与逐像素检测一致。
框歪十几像素、小一圈都能救回来，读图时照着网格估就够了。

## 对账是对象级的

页级像素对账（每一处墨迹归属某个块）代价大、判据脆。真正有力的是对象级对账，
既便宜又强，而且直接对着交付目标：

1. **题号连续** —— 全书题号无缺号、无重号。漏一页、读错一个号、丢一道题，全在这里露头。
2. **图号连续** —— `图 1..图 N` 无缺号。
3. **引用双向齐全** —— 正文里提到的每个「图 N」都存在；每张图都至少被引用一次。
4. **TOC 覆盖** —— 目录说这段页码里有几个单元，就该装订出几个单元。
5. **公式 KaTeX** —— 在**拼完整之后**校验：跨页残片在单页上必然配不平，义务推到 cap2。
6. **行数对账**（页级，唯一保留的）—— 挖掉插图后的印刷行数 == 块体行数。

## 目录布局

```
.tmp/ori-books/soviet10years/5m ….pdf   ← 原书：{书系列名}/{书名}.pdf
resources/s10y-lessons/5m/
├── pages/0015/              ← cap1 页级产物
│   ├── page.md              ★ 带类型的块
│   ├── page.json            结构化视图（cap2 的输入）
│   ├── page.png / page.grid.png / layout.json / audit.json
│   └── figures/fig-07.png|svg
├── figures/fig-07.png|svg   ← 全书图库，按**原书图号**命名，跨页唯一
├── lessons/2-交集/          ← ★ 课程单元
│   ├── lesson.json          课文块 + 元数据
│   ├── lesson.md            完整课文（跨页、跨图都接好）
│   ├── exercises.json       ★ 每题独立：题号、栏目、题干、图号引用；共享图只挂到一题展示
│   ├── text.html            自包含课文页（白底）
│   └── exercises.html       自包含习题页
├── editions/modern-us-neutral/
│   ├── figures/             ★ ld-s10y-image 产物 + 每图一份 FigureSpec
│   ├── lessons/<card-id>/   ★ 可发布的现代 lesson/exercises/figures JSON + 审计
│   └── book.json            edition 索引
└── book.json                全书索引 + 审计报告
```

**book id = 书名首段**（`5m`、`8a`、`9-10g`）。默认跨 `.tmp/ori-books/` 所有书系列
查找，撞名用 `--series`。

工具入口：`.claude/skills/ld-s10y-lesson/.venv/bin/python .claude/skills/ld-s10y-lesson/tools/p2c.py`

依赖引导（缺失时）：
```bash
uv venv <skill>/.venv --python 3.13
uv pip install --python <skill>/.venv/bin/python numpy pillow scipy potracer
cd <skill> && npm install katex @resvg/resvg-js
```
`scipy` 吸附连通域，`potracer` 描摹 SVG，`katex` 校验公式，`resvg` 校验 SVG 保真——
都不是可选的。

---

## cap1 — 单页识别

```bash
p2c.py prepare  --book 5m --page 15     # 渲染整页 + 100px 坐标网格图
#  ↓ 读 page.grid.png，把 page.template.md 填成 page.md
p2c.py finalize --book 5m --page 15     # 吸附裁图 + 规范化 + 页级体检
```

**逐页识别，不要多页一起喂。** 视觉模型的图像 token 预算固定，一次两页就等于把每页
分辨率减半；这批书恰好卡在这上面——西里尔 `а б в` 与拉丁 `a b e` 字形完全相同、
`⩽` 和 `≤` 只差一根横线，都是靠像素分辨的。需要跨页上下文时**传上一页的尾部文字**，
不要传像素。

### 块格式

md 里每块前面一行块头声明它是什么；块体里**一行 = 印刷一行**（行数对账靠这个）。

```markdown
<!-- h1 --> 章    <!-- h2 --> §    <!-- h3 --> 单元标题
<!-- p -->        正文段
<!-- exhead -->   习题栏标题（复习题 / 家庭作业题）
<!-- ex 20 -->    第 20 题，20 是原书题号
<!-- fig 图 7 box 790,1640,490,250 -->   插图/表格，框照网格估
<!-- fig 表 box 790,1640,490,250 owner-ex 20 --> 无编号练习图，明确归第 20 题
<!-- cap 图 7 --> 印刷出来的图题行       <!-- foot --> 页码
```

三个标记：

- `open` —— 这个对象还没完，下面接着（**跨页、也跨插图**）
- `cont` —— 承接上一个同类对象
- `samerow` —— 本块首行与上一块末行印在同一行上（正文右侧的图题、并排的两个图题）

一个被插图从中间截断的段落，写成 `p open` … `fig` … `p cont`，cap2 会接成一段。
配对时 `fig`/`cap`/`foot` 是透明的。

### 转写要点

- **图题是文字**，单独成 `cap` 块；装订时跟随对应图的语义归属，不能一律塞进正文
- 一个「图 N」由几幅小图组成时整体一个框（语义上就是一张图）；框之间不许重叠
- 不带图号、题面也无法引用的练习表格或图，必须在 `fig` 块头写 `owner-ex <题号>`；
  这是归属的唯一事实来源，禁止靠页内最近距离猜测
- 半张表、撕掉一角的表：**按印出来的样子截**，缺口照留，写进 `notes`
- 一条公式被印刷从中间切开：公式写完整，断点处写 `↵`（行数照样对得上，公式也配得平）
- frontmatter 只填 `printed_page` 和 `notes`，哈希一类字段收口时用事实覆盖，不要手抄
- 印刷行末若本该有一个空格（半角句点后、中英之间），**把空格写在行尾**——
  拼接是直接首尾相接的，行尾不留空格，句子接起来就粘住了

数学与字符由 `profiles/soviet-cn.json` 强制：

- 行内 `$...$`；上下标一律 LaTeX（`x^2`），禁止 `x²`；分式 `\frac`，禁 `\dfrac`
- 数学区内减号用 ASCII `-`，禁 `−`(U+2212)
- **习题小问标号必须是西里尔** `а) б) в)`——与拉丁 `a) b) e)` 字形完全相同，
  只能按码点写对。这是最常见的错误来源
- 苏联教材用法式区间记号 `]a, b[`，**照抄，禁止改成 `(a, b)`**
- 含中文的集合 `{俄语、数学}`、含全角标点的数组 `{52 164，32 415}` 写成普通文本，
  不要塞进 `$...$`——CJK 混进数学区是"公式看着对、渲染歪"的主要来源
- 原书印错、破损、污点：**照抄原样**，记进 `notes`，不订正

---

## cap2 — 跨页装订

```bash
p2c.py assemble --book 5m [--toc <toc.json>]
```

四步纯拼接，不需要再猜（cap1 已经把类型和 open/cont 标好了）：

1. **合流** —— `open` 的块与后面 `cont` 的块接成一个对象
2. **切单元** —— `h3` 开一个单元，`h1`/`h2` 是它的祖先标题
3. **分流** —— `ex`/`exhead` 进习题，其余进课文（块类型已经说明了一切）
4. **认领图** —— 真正文提到的图留在正文；只被练习引用的图和图题必须移出正文
5. **共享图去重** —— 每道引用题保存 `figure_refs`，但同一张图在练习区只展示一次，
   挂到原书位置最近的引用题；不能因为两题都写了“图 7”就复制显示两遍

产出 `lessons/<单元>/`：`lesson.md`（完整课文，允许为空）、`exercises.json`
（每题独立编号、图号引用、唯一展示图和来源页）、`lesson.json`。然后跑上面对账。

---

## cap3 — 插图矢量化

```bash
p2c.py vectorize --book 5m [--page N] [--turdsize 2]
```

**位图描摹**（potrace），不是让模型看图重画。描摹是确定性的、逐像素还原轮廓；
模型重画看着漂亮，但那是再创作——会把椭圆画成圆、把格子数画错、把标注挪位，
与"不增删改"直接冲突。图形和文字适用同一条原则。

保真是被验证的：用 **resvg** 把生成的 SVG 回栅格化，与原 PNG 逐像素比对，
不匹配率超 2% 判失败（带 1px 容差——矢量边界落在像素中间，抗锯齿必然有 1px 差）。

两个必须记住的坑：potrace 位图极性要**反相**；even-odd 填充规则只在**单个 `<path>`
元素内部**生效，所有轮廓必须合并进一个 `d`，否则孔洞抵消不掉、整张图被填死。

SVG 用 `fill="currentColor"`，HTML 里可直接用 CSS 换色。

---

## cap4 — 现代主题 edition

```bash
p2c.py adapt-prepare --book 5m --edition modern-us-neutral \
  --lesson math5-c1-s2-n12 --lesson math5-c1-s2-n13
# 编辑 editions/modern-us-neutral/lessons/<id>/*.json，
# 并用 ld-s10y-image 生成图像产物和 *.spec.json
p2c.py adapt-finalize --book 5m --edition modern-us-neutral \
  --lesson math5-c1-s2-n12 --lesson math5-c1-s2-n13
```

这一层是忠实抽取与产品内容之间的唯一转换层：

1. `adapt-prepare` 把原始 lesson/exercises 完整快照和 SHA 写入新 JSON，原始文件不动。
2. 只改文化语境，不改知识点、题号、分组、公式、图引用和题量；非公式数字确需更新时，
   必须逐项写入 `numeric_changes`，并在 `changes` 中包含 `context-number`。
3. 发布文本不得含 profile 禁词或西里尔字母；小问标号改用拉丁字母。
4. 原始层继续按印刷视觉行忠实保存；现代版中若一道题含完整的 `1)..N)` 数字小问，
   必须按编号升序排列，**每个小问独占一行**，并移除原书多栏对齐所用的全角空格。
   `adapt-finalize` 会确定性执行该排版规范，禁止手改原始 `pages/` 或原始 lesson JSON。
5. 每张产品图委托项目技能 `ld-s10y-image`，并配
   `ld-s10y-image/figure-spec@1`：
   - 数轴、几何、网格、刻度、坐标、变换、图表和数学标签用 JSXGraph 确定性生成
   - 动物、人物、树木和场景等语义素材用 Azure `gpt-image-2`
   - 同时需要自然对象与精确数学关系时，用 GPT artwork + JSXGraph overlay 的 hybrid 模式
   - 输入必须包含完整相关 edition 题面/正文与原始抽取图 PNG；edition 文本是语义真相
   - 禁止使用答案键或添加原图没有的解答标注，不能让题图泄露答案
   - 禁止手改渲染器产物、直接发布原书截图，或让 GPT Image 猜精确刻度和标签位置
6. **图内语言固定为英文**：数字、拉丁字母和数学符号可直接使用；禁止中文、日文、
   西里尔文字、苏联文化符号、旧书纹理和手写体。课程正文仍为中文。
7. 先按 [现代图生成流程](references/figure-generation.md) 完成 FigureSpec、数学断言、
   渲染碰撞检测和目视验收；任一不符时最多针对缺陷修复一次。
8. `adapt-finalize` 校验原始快照、数学、FigureSpec、渲染或生成元数据；失败不能发布。

原始层 cap3 的 potrace 只用于保存教材抽取事实；现代 edition 的图必须重新创作，两者用途不同。

### 完整图生成流程

context package、渲染路由、FigureSpec、`n-azure` 和视觉门禁见
[references/figure-generation.md](references/figure-generation.md)。预览批次只写 `.tmp/`；
用户验收后才提升到 edition。

---

## cap5 — 自包含 HTML

```bash
p2c.py render --book 5m --edition modern-us-neutral [--lesson <cardId>]...
```

每个单元两张白底页：`text.html`（课文，原书无正文时为空）+ `exercises.html`
（每题独立编号，共享练习图只展示一次）。
自包含指不依赖网络也不依赖同级文件：KaTeX 服务端渲染成静态 HTML（页面不要 JS）、
CSS 与 20 个 woff2 字体内联成 data URI，插图 SVG 或 PNG 都内联。

> 坑：`katex.min.css` 里 `src` 是 `@font-face` 的**最后一条**声明，以 `}` 结尾而非 `;`。
> 按 `;` 匹配会一个字体都替换不到，页面看着能用（系统字体兜底）但并不自包含。
> 现在内联数为 0 直接抛错，不允许静默降级。

---

## cap6 — 生产入库

```bash
node .claude/skills/ld-s10y-lesson/tools/publish.mjs resources/s10y-lessons/5m \
  --edition modern-us-neutral [--lesson <cardId>]... [--dry]
```

一个单元 = `sr_lessons` 一行，**id 就是 cap2 从 TOC 认领的卡片 id**——这是 app 定的
（见 `app/src/lib/deck-stats.ts`），所以不建新表。`content` 放课文块、`exercises` 放每道题，
两者都是可直接嵌入的 HTML 片段（KaTeX 已渲染、插图为内联图片数据），由产品自己排版；
`html` 列不再写入。幂等 upsert，重复跑不会伤到别的课。

`--lesson` 可重复，用于只写本次已经完整闭合的单元。跨页抽取为了完成上一单元而读到了
下一单元开头时，必须指定它，禁止把只有标题或一道题的半个单元写进生产。

发布器只读取 `editions/<edition>/lessons/`，要求 adaptation audit 为 `pass`，并验证
现代图、FigureSpec 与生成/渲染元数据。写入 DB 时只保留现代正文、现代题目、现代图片、edition 名和原始
SHA；完整原始快照不入库。重发课文或图片时必须保留同题号已有的 `answerKey`。

连接串取仓库根 `.env` 的 `LEMMADECK_DATABASE_URL`（Supabase，schema `lemmadeck-schema`）。
**不要用 psql**：这个串的密码含 `@`，psql 会当成主机名分隔符而解析失败。

## cap7 — 产品验收

生产写入不是完成；孩子在产品里能读到才是完成。

1. 用 node + `app/node_modules/postgres` 查询目标 `sr_lessons` 行，核对
   `content.edition`、`exercises.edition`、`content.prose` 和 `exercises.count`；
   edition 必须等于本次发布值，只有练习的单元允许 `content.prose=[]`
2. `cd app && npm run dev`，固定端口 3200
3. 浏览器打开每个目标 `/card/<cardId>`，确认正文没有混入练习专用图、插图清晰、
   习题入口与题数
4. 打开每节的习题视图，确认所有题都能渲染，并按 `figure id` 检查同一张共享图
   在该练习区只出现一次
5. 检查桌面与 390px 移动宽度无整页横向溢出，控制台无报错

任一项失败都要修到通过。只生成文件、只 dry-run、只写库但没在产品验证，都不算完成。

## 实测（5m 印刷页 1–11，PDF 10–20）

11 页 → **4 个单元、55 道题（1–55 连续无缺号）、13 张编号插图 + 1 张无编号表格**。
15 张 SVG 全部通过保真自检，不匹配率 0.000%–0.093%（限 2%）。
跨页的第 29、36 题各由三段拼成，图自动跟到题上。

## 已知行为

- 一道题引用「图 6.2」时会保留对图 6 各子图的引用；每个实际 SVG 在练习区仍只展示一次
- `outside_ratio` 只是"文字占墨迹的比例"，不是错误指标
- 不做语义提取：表格一律当图裁，不拆成行列
- 一本书没抽完时，末尾会有若干块标着 `open` 接不上——这是正常的，只报告不失败
