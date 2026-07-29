---
name: ld-mathpdf
description: 把扫描版数学/理科教材 PDF 逐页转成严格结构化的 JSON + 插图 SVG，保证文本零增删改、公式可渲染、图文位置对应、全书写法统一。用于纯扫描（无文字层）的老教材数字化。包含 cap1 单页提取、cap2 邻页缝合、cap3 全书一致性、cap4 插图矢量化。
---

# ld-mathpdf

把**纯扫描**的数学/理科教材 PDF 转成可靠的结构化文本。

适用判据：`pdffonts book.pdf` 无嵌入字体、`pdftotext` 提取 0 字符 → 该书没有文字层，
所有"抽取文字层"的工具（含 markitdown 默认路径）都会输出空白，必须走本技能。

## 三条铁律

1. **编码统一，字面照抄**
   - 允许：同一字符的不同编码形式统一（全角 `３`→`3`、`x²`→`x^2`、`\dfrac`→`\frac`）
   - 禁止：任何内容层修改。原书印错也照抄 + 上报，不得订正。
2. **只报告，不推断**（cap1）
   单页视野看不到的一律标记，不猜。跨页的事交给 cap2。
3. **cap2 不得改字**
   缝合环节只能改元数据（类型、接续关系、图引用），文本一个字都不能动。
   发现疑似错字只能写进 `suggestions` 进人工队列。这条由 `stitch-check` 机械阻断。

## 目录布局

```
{root}/{book_id}/
├── pages/0044/            ← cap1 产物，写完即只读
│   ├── page.png           整页渲染图
│   ├── blocks.json        版面候选（确定性产出）
│   ├── page.json          ★ 本页自足事实
│   ├── figures/fig-01.png 插图/表格裁切
│   └── finalize.report.json
│   ├── figures/fig-01.svg cap4 矢量化产物（与 PNG 同名同级）
│   └── vectorize.report.json
├── stitched/0044/         ← cap2 产物，禁止写入 pages/
│   ├── window.json        三页输入包
│   ├── meta.json          ★ 缝合终稿
│   ├── stitch.json        ★ 改动自证
│   └── check.report.json
└── consistency.json       ← cap3 产物
```

工具入口：`.claude/skills/ld-mathpdf/.venv/bin/python .claude/skills/ld-mathpdf/tools/ldmath.py`

依赖引导（缺失时）：
```bash
uv venv <skill>/.venv --python 3.13
uv pip install --python <skill>/.venv/bin/python numpy pillow jsonschema potracer
cd <skill> && npm install katex @resvg/resvg-js
```
node 侧两个包不是可选的：**KaTeX 用来校验公式，resvg 用来校验 SVG 保真**。

---

## cap1 — 单页完整提取（零依赖）

给定 `{pdf, book_id, page, profile}` 就能独立跑完，**不读任何其他页、不依赖任何前置步骤**。
因此任意页可乱序、任意并发、单独重跑。幂等键 = `render.sha256`。

### 步骤

**1) 备料（确定性）**
```bash
ldmath.py prepare --pdf "<PDF>" --book <id> --page <N> --root <root>
```
渲染 300dpi → 行投影切带 → 挑出插图/表格候选 → 裁 `figures/fig-NN.png` → 写 `blocks.json`
和 `page.template.json`。

候选带的 `kind` 有三种：`text_band`、`figure`、`margin_band`。插图判据是**长横线或长竖线**
（图框、坐标轴、表格线），单纯"比正文高"不算——数学正文有分式和括号，会长得很高。
竖线检测排除左右页边，否则扫描件的页边黑线会被当成坐标轴。
`margin_band` 是上下页边的低阈值补捞，专为页码这类墨迹稀少的短行——它们会低于正文行阈值
而被丢掉，而页码承载 `printed_page`，不能漏。

**2) 转写（视觉）**
Read `page.png`（必要时并读 `figures/*.png` 核对裁切范围），以 `page.template.json` 为骨架
写出 `page.json`。**blocks 数组是唯一真源**，按阅读顺序排列。

**3) 收口（确定性）**
```bash
ldmath.py finalize --pdf "<PDF>" --book <id> --page <N> --root <root>
```
自动规范化 + schema 校验 + 字符白名单 + bbox 越界检查 + 小问标号码点检查
+ **公式校验**。**不通过就是失败，必须回到第 2 步修**，不允许放行。

公式校验分两层：`$`/`$$` 配对与花括号平衡（结构），以及**用 KaTeX 真实解析每一条公式**。
校验用的引擎就是将来 HTML 渲染用的引擎，所以 cap1 通过 ⇒ 网页一定渲得出来，
而不是"看着像 LaTeX"。KaTeX 的 `unicodeTextInMathMode` 一类告警也会打印出来——
它正是"公式看着对、渲染歪"的主要来源（例如中文混进了数学区）。

### 转写规则（第 2 步）

**块类型**（封闭枚举）：
`heading` `paragraph` `formula_block` `figure` `problem` `answer` `toc_entry`
`page_header` `page_footer` `note`

- **表格一律 `figure`**（`figure_kind: "table"`），只裁图，**不做语义提取**。
- 页眉页脚要作为 block 记录，置 `in_reading_flow: false`；页码同时填进 `printed_page`。
- 插图 block 必须有 `label`（如 `图 14`）、`file`、`figure_kind`。图题文字不进裁图，进 `label`。
- 习题用 `problem`，`number` 是题号，小问进 `items: [{key, text}]`。

**数学与字符**（由 profile 强制，写的时候就按规范来可省一次返工）：
- 行内 `$...$`，独立成行 `$$...$$`
- 上下标一律 LaTeX：`x^2`、`x_1`；**禁止** `x²` `x₁` 这类 Unicode 字符
- 单字符上下标不加花括号（`x^2` 而非 `x^{2}`），多字符加（`x^{10}`）
- 分式用 `\frac`，禁用 `\dfrac`
- 数学区内减号用 ASCII `-`，禁用 `−`(U+2212)
- **习题小问标号必须是西里尔字母** `а) б) в) г) д) е)` —— 它们和拉丁 `a) b) e)`
  **字形完全相同**，肉眼分辨不出，必须按码点写对。这是本技能最常见的错误来源。
- 苏联教材用法式区间记号 `]a, b[` 表开区间，**照抄，禁止改成 `(a, b)`**

**只报告不推断**：
| 情形 | 怎么记 |
|---|---|
| 句子在页末未完 | `flags.ends_mid_sentence: true` |
| 页首承接上页 | `flags.starts_mid_sentence: true` |
| 本页插图找不到引用 | 照记，**不报错**（引用可能在邻页） |
| 段落/题目/表格跨页断开 | 该 block 置 `cont_to_next_page: true` |
| 字迹无法辨认 | 写 `〇`，并记入 `flags.illegible` |
| 原书自身印错 | **照抄原样**，记入 `flags.source_errors` |

---

## cap2 — 邻页缝合（三页窗口）

```bash
ldmath.py window --book <id> --page <N> --root <root>      # 备料
# → 读 stitched/{N}/window.json，产出 meta.json + stitch.json
ldmath.py stitch-check --book <id> --page <N> --root <root>  # 收口
```

输入是 N−1 / N / N+1 的 **cap1 事实**（不是原图）。**只允许写第 N 页的目录，邻页只读**——
否则相邻窗口会互相踩写。

`meta.json` = 以本页 `page.json` 为基底，只改元数据。允许的操作仅四种：

| op | 用途 |
|---|---|
| `merge_across_page` | 标记本页 block 与邻页 block 的接续关系（**记录关系，不合并文本**） |
| `reclassify` | 改 block 类型（主要用于三页对比后确认页眉页脚） |
| `attach_figure_ref` | 跨页建立插图与其正文引用的关联 |
| `mark_continuation` | 标记接续标志 |

每条改动必须在 `stitch.json` 写明 `reason`。发现疑似错字 → 只能进 `suggestions`，
**不能执行**。`stitch-check` 会逐字段比对 cap1/cap2 文本，任何改字、增块、删块都会硬失败。

---

## cap3 — 全书一致性

```bash
ldmath.py consistency --book <id> --root <root>
```

扫描全书所有 `page.json`，做四件事：

1. **profile 符合性**：全书写法一致、但整体违反 profile 的情况（例如通篇都用 `\dfrac`）。
   这类问题漂移检测**看不见**——只有一种写法就不算漂移——必须单独查。
2. **写法漂移检测**：同一轴上出现多种写法就报警，并列出少数派在哪几页。
   监测轴包括：`图 N` 是否带空格、`\frac`/`\dfrac`、LaTeX/Unicode 上下标、减号码点、
   句读全角/半角、`§` 空格、区间记号。
3. **字符白名单**：白名单外的码点全部列出（页码 + block 定位）。
4. **小问标号码点**：逐个检查是否真的是西里尔字母。

有任何一项不干净就返回非零。一致性的**执行**在 cap1（profile + 白名单），
cap3 负责**跨页验证**——单页看不出漂移，只有全书统计才看得见。

---

## cap4 — 插图矢量化（PNG → SVG）

```bash
ldmath.py vectorize --book <id> --root <root> [--page N] [--turdsize 2]
```

产出 `figures/fig-NN.svg`，与源 PNG **同名同级**。`page.json` 里 `file` 字段仍指向 PNG
（PNG 是事实基准，不改动 cap1 产物）；HTML 组装时按同名换扩展名取 SVG 即可。

### 为什么是描摹，不是让模型重画

**位图描摹**（potrace 算法）是确定性的，逐像素还原原图轮廓。让模型"看图重画 SVG"
看着更漂亮，但那是**再创作**：会把椭圆画成圆、把格子数画错、把标注位置挪动。
这与本技能"不增删改"的铁律直接冲突。图形和文字适用同一条原则。

### 保真是被验证的，不是被声称的

生成 SVG 后用 **resvg**（真正的 SVG 渲染引擎）回栅格化，与原 PNG 逐像素比对，
不匹配率超过 2% 即判失败。比对带 1px 容差——矢量边界落在像素中间，抗锯齿必然产生
1px 级差异，不带容差会把正确结果误判为失败。

实测：8a 第 44 页两幅坐标图，不匹配率 **0.269%** 和 **0.214%**。

### 两个必须记住的坑（都是实测撞出来的）

1. **potrace 位图极性要反相**：传 `~ink_mask`。传正相会描摹出白色区域，
   填充面积正好等于图像的白色部分。
2. **even-odd 填充规则只在单个 `<path>` 元素内部生效**。所有轮廓必须合并进
   一个 `<path d="...">`；写成多个 `<path>` 元素时孔洞无法抵消，整张图会被填死。

`--turdsize` 控制丢弃的最小斑点面积：默认 2（potrace 默认，最保真，保留扫描噪点）；
调大更干净但偏离原图，不匹配率会同步上升——**代价是可见的**。

SVG 用 `fill="currentColor"` + 根元素 `color="#000"`，HTML 里可直接用 CSS 换色（深色模式）。

---

## cap5 — 单页 → 自包含 HTML

```bash
ldmath.py render --book <id> --page N --root <root> [--source auto|cap1|cap2] [--out x.html]
```

`auto` 优先用 cap2 的 `meta.json`，没有则回落 cap1 的 `page.json`。产出双击即可打开。

**自包含**指不依赖网络也不依赖同级文件：
- KaTeX **服务端渲染**成静态 HTML，页面不需要 JS
- KaTeX 的 CSS 与 20 个 woff2 字体以 data URI 内联
- 插图 SVG 直接内联（缺 SVG 时回落成 base64 PNG）

> 坑：`katex.min.css` 里 `src` 是 `@font-face` 的最后一条声明，**以 `}` 结尾而非 `;`**。
> 按 `;` 去匹配会一个字体都替换不到，页面看着能用（系统字体兜底）但并不自包含。
> 现在内联数为 0 会直接抛错，不允许静默降级。

### 半截表格规则

跨页的图/表只在**起始页**渲染：

| 本页情形 | 行为 |
|---|---|
| 上半截（`cont_to_next_page`） | 渲染 |
| 下半截（`cont_from_prev_page`） | **跳过**，并在返回值 `skipped` 里记明原因 |

这样同一张表不会在相邻两页各出现一半。跳过项会显示在页面底部的提示条里，不静默丢弃。

### 版式约定

正文缩进 2 字、行距 1.95、宋体族；独立公式居中，`\tag{n}` 右对齐；
习题小问按印刷版式排成两栏；页脚渲染成 `· 38 ·` 样式。
公式与紧随其后的标点用 `nowrap` 绑定——否则 `$…$;` 的分号会被甩到下一行。

图题（如「图 14」）已烙在裁切图内，因此不再重复输出可见 `figcaption`，只作 `aria-label`。

---

### profile

`profiles/soviet-cn.json` 是这批苏联教材的规范化配置。
**profile 是输入参数，不是推导产物**——必须先于所有页固定，否则先跑和后跑的页规则不同。
换一批书就新建一份 profile，不要改旧的。
