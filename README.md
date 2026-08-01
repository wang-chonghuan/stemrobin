# LemmaDeck

面向一名 8 岁孩子的**初中数学/物理自学课程产品**（线上：https://lemmadeck.com）。
原则是**内容按初中标准，解释按儿童认知，训练按严肃教材**——不阉割概念，只重排入口与坡度。

课程内容不再由 AI 撰写，而是从**苏联十年制学校教材**（1978–1982 中译本扫描件）逐页抽取
真实课文与习题。第二支柱是短文学英语（VOA1500 核心词，读懂 → 提示递减 → 全文默写）。

产品目标与红线是人拥有的，见 `.prodfarm/charter/`（batch 内冻结，不要中途改）。

---

## 仓库长什么样

| 目录 | 是什么 |
|---|---|
| `app/` | web 应用，**独立工程**（自己的 package.json / node_modules，仓库根没有） |
| `page2class/` | 教材抽取产物：页级底稿、全书图库、按单元成课的成品 |
| `ssot-resources/` | 教材目录（TOC）等真源；app 的课程目录就是读它 |
| `ssot-schemas/` | 数据库 schema 真源 |
| `.claude/skills/` | 本仓库自己的 agent 技能（`ld-page2class`） |
| `.agents/skills/` | 内容生成技能（`sr-story` 传记、`sr-voa1500` 英语、`ld-galaxy` 首页星图） |
| `.prodfarm/charter/` | 产品目标、红线、工程规约、架构、运维手册（人拥有） |
| `.tmp/` | 已 gitignore 的暂存区：原书 PDF、数据库备份 |

`AGENTS.md` 是给 agent 的路由表，知识分别住在哪里由它说了算。

## 开发注意事项

**数据库有两个，别打错。** 内容库已从 Azure 迁到 Supabase：`LEMMADECK_DATABASE_URL`
优先，schema 是 `lemmadeck-schema`；`EASYAPP_DATABASE_URL`（Azure，`stemrobin-schema`）
是旧库，app 早就不读了。判据在 `app/src/lib/db.ts`。

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
```

---

## 怎么从 PDF 生成一个单元

技能是 `ld-page2class`（`.claude/skills/ld-page2class/`），五步。**第二步是模型看图转写，
其余四步是确定性的。**

```bash
P=.claude/skills/ld-page2class/.venv/bin/python
S=.claude/skills/ld-page2class/tools/p2c.py

$P $S prepare  --book 5m --page 15        # ① 渲染整页 + 坐标网格图
#                                           ② 读 page.grid.png，把 page.template.md 填成 page.md
$P $S finalize --book 5m --page 15        # ③ 吸附裁图 + 规范化 + 页级体检
#   ①②③ 对每一页重复

$P $S assemble  --book 5m --toc ssot-resources/soviet10year-textbooks/toc/5m/zh.json
$P $S vectorize --book 5m                 # 插图 PNG → SVG（描摹 + 保真自检）
$P $S assemble  --book 5m --toc ssot-resources/soviet10year-textbooks/toc/5m/zh.json
node .claude/skills/ld-page2class/tools/publish.mjs page2class/5m \
  --lesson math5-c1-s1-n5                 # 只写已完整的目标单元
```

`assemble` 的 `--toc` **不能省**——课的 id 是从目录认领的，没有它产品里就没有地址。
`p2c.py render` 另外产出可双击打开的自包含 HTML（课文页 + 习题页），用于离线检查。

### 指示一个新会话干这件事

一句话就够，剩下的技能自己查 TOC、换算页码、入库并在产品验收。推荐按**单元**说：

> 用 ld-page2class 抽 5m 第 8 单元
>
> 用 ld-page2class 抽 5m 第 5–7 单元
>
> 用 ld-page2class 抽 5m 第一章「正数和负数」§1「集合的运算」第 5 单元「分类」

这里的**单元**专指原书目录中全书连续编号的最小内容项（TOC 的
`topics[].printedNumber`）；章、节只是帮助定位。也仍可直接给 PDF 页码。技能会用
`ssot-resources/soviet10year-textbooks/toc/<book>/zh.json` 找到起止印刷页，并为跨页对象
自动多取必要的边界页，不需要人手算 PDF 页码。

技能自己的文档在 `.claude/skills/ld-page2class/SKILL.md`，转写规则（西里尔小问标号、
法式区间记号、跨行公式的 `↵` 等）都在那里，这里不重复。

### 它能保证什么

对账是**对象级**的，跑通即意味着：题号连续无缺号、图号连续、正文里提到的每张图都存在且
每张图都被引用、TOC 说有几个单元就装订出几个单元、公式拼完整后 KaTeX 能解析、页内印刷
行数与转写行数一致。任何一条不过就是失败。

插图是 **potrace 描摹**不是模型重画，保真由 resvg 回栅格化逐像素验证（限 2%，实测
0.000%–0.093%）。

### 现在到哪儿了

5m 印刷页 1–22（PDF 10–31）已完成：7 个单元、104 道题（1–104 连续）、32 张 SVG，
已入库并在产品里可读。

**它还不是全自动的**：每一页都要模型看图转写一遍，这是目前最花时间的一步。换一批书需要
先固定一份 profile（`profiles/soviet-cn.json` 是苏联这批的），profile 是输入参数，
必须先于所有页确定。
