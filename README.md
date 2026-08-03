# LemmaDeck

面向一名 8 岁孩子的**初中数学/物理自学课程产品**（线上：https://lemmadeck.com）。
原则是**内容按初中标准，解释按儿童认知，训练按严肃教材**——不阉割概念，只重排入口与坡度。

数学知识、题号、数值和结构来自**苏联十年制学校教材**（1978–1982 中译本扫描件），
不是让 AI 从零编教材。产品发布的是 `modern-us-neutral` edition：保留数学内容，替换过时
文化语境，并重新制作插图。AI 只参与视觉转写、受约束的现代化改写、缺失答案推导和语义
插画生成，所有产物都要经过确定性校验。第二支柱是短文学英语（VOA1500 核心词，
读懂 → 提示递减 → 全文默写）。

产品目标与红线是人拥有的，见 `.prodfarm/charter/`（batch 内冻结，不要中途改）。

---

## 仓库长什么样

| 目录 | 是什么 |
|---|---|
| `app/` | web 应用，**独立工程**（自己的 package.json / node_modules，仓库根没有） |
| `resources/s10y-lessons/` | 教材抽取产物：按书存放页级底稿、全书图库和课程成品 |
| `ssot-resources/` | 教材目录（TOC）等真源；app 的课程目录就是读它 |
| `ssot-schemas/` | 数据库 schema 真源 |
| `.claude/skills/` | 本仓库自己的教材技能（`ld-s10y-lesson`、`ld-s10y-answer`） |
| `.agents/skills/` | 项目技能（`ld-s10y-image` 现代插图、`sr-story` 传记、`sr-voa1500` 英语、`ld-galaxy` 首页星图） |
| `.prodfarm/charter/` | 产品目标、红线、工程规约、架构、运维手册（人拥有） |
| `.tmp/` | 已 gitignore 的暂存区：原书 PDF、数据库备份 |

`AGENTS.md` 是给 agent 的路由表，知识分别住在哪里由它说了算。

当前 app 支持公开浏览教材、课文/练习切换、MathLive 数学输入、服务端判题、错题本与重做、
登录后保存学习记录，以及短文学英语的阅读和提示递减背诵。未登录用户仍可浏览课程；登录
页的邮箱登记只写入候选邮箱表，不等于自动创建学习账号。

## 开发注意事项

**活动数据库是 Supabase。** `LEMMADECK_DATABASE_URL` 优先，schema 是
`lemmadeck-schema`。`EASYAPP_DATABASE_URL` / `DATABASE_URL` 只保留为旧部署兼容回退；
新内容和 schema 变更都应面向 LemmaDeck 库。运行时判据在 `app/src/lib/db.ts`。

**连接串不能喂给 psql。** Supabase 那个串的密码里含 `@`，psql 会当成主机名分隔符而解析
失败。用 node + 仓库自带的 `postgres` 客户端连（`app/node_modules/postgres`）。

**内容存在哪。** 一个单元 = `sr_lessons` 一行，**id 就是教材目录里那张卡片的 id**
（`math5-c1-s1-n1`），不另建表。`content` 放课文块，`exercises` 放每道题，`html` 列已废弃
不再写入。目录里某一项能不能点，取决于库里有没有它的行——`listAvailableLessonIds`。

**原书 PDF 不入 git。** 放 `.tmp/ori-books/{书系列名}/{书名}.pdf`（约 215MB）。

**动生产数据要人批准。** 见 `.prodfarm/charter/redlines.md` 第 2 条。删库前先备份到
`.tmp/backup/`。

**常用命令**（更全的见 `.prodfarm/charter/runbook.md`）：

```bash
cd app && npm run dev     # 开发服务器，固定 3200 端口
cd app && npm run test    # vitest
cd app && npm run build   # 生产构建
cd app && npm run e2e     # Playwright
```

---

## 怎么从 PDF 生成一个单元

主技能是 `ld-s10y-lesson`（`.claude/skills/ld-s10y-lesson/`）。原始页转写需要模型看图，
装订、对账、版式规范化、FigureSpec 校验和发布均由工具完成。

```bash
P=.claude/skills/ld-s10y-lesson/.venv/bin/python
S=.claude/skills/ld-s10y-lesson/tools/p2c.py

$P $S prepare  --book 5m --page 15        # ① 渲染整页 + 坐标网格图
#                                           ② 读 page.grid.png，把 page.template.md 填成 page.md
$P $S finalize --book 5m --page 15        # ③ 吸附裁图 + 规范化 + 页级体检
#   ①②③ 对每一页重复

$P $S assemble  --book 5m --toc ssot-resources/soviet10year-textbooks/toc/5m/zh.json
$P $S vectorize --book 5m                 # 原始抽取层 PNG → SVG（描摹 + 保真自检）
$P $S assemble  --book 5m --toc ssot-resources/soviet10year-textbooks/toc/5m/zh.json
$P $S adapt-prepare --book 5m --edition modern-us-neutral \
  --lesson math5-c1-s1-n5
# 只编辑 edition JSON；所有现代图交给 .agents/skills/ld-s10y-image：
# 数轴/几何/图表走 JSXGraph，人物/动物/场景走 gpt-image-2，混合图组合两者
$P $S adapt-finalize --book 5m --edition modern-us-neutral \
  --lesson math5-c1-s1-n5
$P $S render --book 5m --edition modern-us-neutral \
  --lesson math5-c1-s1-n5                 # 离线视觉检查
node .claude/skills/ld-s10y-lesson/tools/publish.mjs resources/s10y-lessons/5m \
  --edition modern-us-neutral \
  --lesson math5-c1-s1-n5                 # 只写已完整的目标单元

K=.claude/skills/ld-s10y-answer/tools/lesson_answers.py
python3 $K prepare --book 5m --edition modern-us-neutral \
  --lesson math5-c1-s1-n5
# 逐题完成 edition 下的 answer-keys.json
python3 $K finalize --book 5m --edition modern-us-neutral \
  --lesson math5-c1-s1-n5
node .claude/skills/ld-s10y-answer/tools/publish.mjs resources/s10y-lessons/5m \
  --edition modern-us-neutral \
  --lesson math5-c1-s1-n5
```

`assemble` 的 `--toc` **不能省**——课的 id 是从目录认领的，没有它产品里就没有地址。
原始 `pages/`、`figures/`、`lessons/` 永远保持忠实抽取；文化改写、新图和答案键只进入
`editions/<edition>/`。发布顺序是先 lesson、后 answer，二者都必须真实写库，不能把
`--dry` 当作交付终点。

### 指示一个新会话干这件事

一句话就够，剩下的技能自己查 TOC、换算页码、入库并在产品验收。推荐按**单元**说：

> 用 ld-s10y-lesson 抽 5m 第 8 单元
>
> 用 ld-s10y-lesson 抽 5m 第 5–7 单元
>
> 用 ld-s10y-lesson 抽 5m 第一章「正数和负数」§1「集合的运算」第 5 单元「分类」

这里的**单元**专指原书目录中全书连续编号的最小内容项（TOC 的
`topics[].printedNumber`）；章、节只是帮助定位。也仍可直接给 PDF 页码。技能会用
`ssot-resources/soviet10year-textbooks/toc/<book>/zh.json` 找到起止印刷页，并为跨页对象
自动多取必要的边界页，不需要人手算 PDF 页码。

技能自己的文档在 `.claude/skills/ld-s10y-lesson/SKILL.md`，转写规则（西里尔小问标号、
法式区间记号、跨行公式的 `↵` 等）都在那里，这里不重复。

### Soviet 10 Years 术语

- `lesson`：一本书中全局连续编号的课程单元。
- `exercise`：一本书中全局连续编号的练习。
- `answer`：一个 exercise 对应的答案。

答案由独立技能 `ld-s10y-answer` 负责：

- cap1 忠实抄录书后答案到 `resources/s10y-lessons/<book>/answers.json`，作为原书证据；
- cap2 读取指定 edition 题面和现代图，为每道题生成
  `editions/<edition>/lessons/<lesson-id>/answer-keys.json`；
- 有书后答案时保留 `bookRaw`，没有或不完整时现场求解；可可靠判定的题生成 `auto`
  判题结构，作图/证明等题使用 `ungraded`，但仍必须提供标准答案；
- 发布器只把答案附加到数据库中相同 edition、相同题号的课程，原始 `answers.json`
  永不直接入库。

### 它能保证什么

对账是**对象级**的，跑通即意味着：题号连续无缺号、图号连续、正文里提到的每张图都存在且
每张图都被引用、TOC 说有几个单元就装订出几个单元、公式拼完整后 KaTeX 能解析、页内印刷
行数与转写行数一致。任何一条不过就是失败。

原始抽取层插图用 **potrace 描摹**保存教材事实，保真由 resvg 回栅格化逐像素验证。
产品现代图不再直接发布这些描摹图，而是统一经过 `ld-s10y-image`：

- 点、线、坐标、刻度、数轴、几何、表格和图表由 JSXGraph 确定性渲染；
- 人物、动物、树木和场景等语义插画由 Azure `gpt-image-2` 生成；
- 同时需要自然对象与精确数学关系时采用 hybrid；
- 每张图必须有 FigureSpec、原题 edition 文本、原图证据、数学断言、碰撞检查和视觉审查；
  图中文字固定为英文，禁止重新带入俄文姓名或苏联文化文字。

### 现在到哪儿了

截至当前仓库状态，5m 印刷页 1–61（PDF 10–71）已完成并发布：

- 16 个单元（第 1–16 课）；
- 285 道题（题号 1–285 连续、无缺号和重复）；
- 82 张现代 edition 图（76 张确定性图、6 张 generated/hybrid 图）；
- 285 份标准答案（181 道自动判题、104 道展示标准答案但不自动判定）。

**它还不是全自动的**：每一页都要模型看图转写一遍，这是目前最花时间的一步。换一批书需要
先固定一份 profile（`profiles/soviet-cn.json` 是苏联这批的），profile 是输入参数，
必须先于所有页确定。
