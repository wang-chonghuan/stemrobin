---
name: ld-s10y-answer
description: Load when the user asks to extract Soviet ten-year-school textbook answers, or to add production-ready answers to selected lessons, including requests such as “抽取 5m 的全部答案”, “读取书后答案页”, “给 5m 第 5–7 lesson 加答案”, or “把这些 exercise 的答案写进数据库”.
---

# ld-s10y-answer

从 Soviet 10 Years 教材扫描件中忠实抄录书后答案，并按 exercise 编号生成一本书一份的
结构化答案文件。

## 术语

- **lesson**：一本书中全局连续编号的课程单元。
- **exercise**：一本书中全局连续编号的练习。
- **answer**：一个 exercise 对应的答案。

本技能有两个能力：

- **cap1：答案抄录**，忠实保存书后答案页。
- **cap2：edition lesson 答案生产**，为指定现代版 lesson 的每个 exercise 生成可展示、
  可判题的答案键并写库。

原始 `answers.json` 只作为书后答案证据，永不直接入库。答案键只允许生成到
`editions/<edition>/lessons/`，并且只能附加到数据库中同一 edition 的课程。

## cap1 — 答案抄录

从仓库根目录执行：

```bash
A=.claude/skills/ld-s10y-answer/tools/answers.py

python3 $A prepare --book 5m --pages 305-309
# 逐页查看 .tmp/ld-s10y-answer/5m/pages/page-*.png，
# 按模板生成 resources/s10y-lessons/5m/answers.json
python3 $A finalize --book 5m
```

`--pages` 是 PDF 物理页，支持 `305-309`、`305,307,309` 和混合写法。书默认从
`.tmp/ori-books/*/<book> *.pdf` 唯一定位；撞名时用 `--series`，特殊情况用 `--pdf`。

### 输出

稳定产物是 `resources/s10y-lessons/<book>/answers.json`：

```json
{
  "schema": "ld-s10y-answer/book@1",
  "book": "5m",
  "source": {
    "pdf": "5m 苏联十年制学校教材 数学 五年级.pdf",
    "pdfSha256": "...",
    "pdfPages": [305],
    "printedPages": [296]
  },
  "status": "draft",
  "answers": [
    {
      "exercise": 9,
      "raw": "18 卢布",
      "pdfPage": 305,
      "printedPage": 296
    }
  ]
}
```

- 一条印刷答案对应一个对象；多小问仍放在同一个 `raw` 中，保持原顺序。
- `raw` 忠实记录原书，不改正、不推导、不拆成判题结构。
- 看不清的字符照最可能字形抄录，并加 `needsReview: true` 和 `reviewNote`。
- 答案页没有出现的 exercise 不写入；“原书略答”只有以后与完整 exercise 清单对齐后才能判定。
- `finalize` 通过后只表示抄录结构完整，`status` 会变为 `captured`；不表示数学答案已验证。

## 模型与机器分工

| 谁 | 职责 |
|---|---|
| 模型 | 看图识别 exercise 号、答案文本、小问顺序、单位和不清晰字形 |
| `answers.py` | 找书、渲染、生成模板、检查 JSON、去重、排序、记录审计 |

完成抄录后必须执行 [gate-1-capture](references/gate-1-capture/gate.md)，然后再运行
`finalize`。Gate 只检查是否忠实抄录，不检查数学正确性。

## cap2 — lesson 答案生产

用户指定书和一个或多个 lesson，例如：

> 给 5m 的 math5-c1-s1-n5、math5-c1-s1-n6、math5-c1-s1-n7 加答案

从仓库根执行：

```bash
K=.claude/skills/ld-s10y-answer/tools/lesson_answers.py

python3 $K prepare --book 5m \
  --edition modern-us-neutral \
  --lesson math5-c1-s1-n5 --lesson math5-c1-s1-n6 --lesson math5-c1-s1-n7
# 模型逐题完成 editions/modern-us-neutral/lessons/<id>/answer-keys.json
python3 $K finalize --book 5m \
  --edition modern-us-neutral \
  --lesson math5-c1-s1-n5 --lesson math5-c1-s1-n6 --lesson math5-c1-s1-n7

node .claude/skills/ld-s10y-answer/tools/publish.mjs resources/s10y-lessons/5m \
  --edition modern-us-neutral \
  --lesson math5-c1-s1-n5 --lesson math5-c1-s1-n6 --lesson math5-c1-s1-n7
```

### 生成规则

1. 每个已抽取 exercise 必须恰有一个 answer key。
2. 题面必须读取指定 edition；`resources/s10y-lessons/<book>/answers.json` 有书后答案时
   优先参考并保留为 `bookRaw`。
3. `prepare` 提供 `figureEvidence` 时，必须实际查看现代图、原始 PNG 和 FigureSpec 后
   作答。现代题面是语义权威，原图用于核对数值、位置与构图；禁止写“题面未附图”或
   用通用判定方法代替具体标准答案。
4. 书后未列答案时，由执行技能的模型根据题面和插图现场求解，`source` 写 `derived`。
5. 原书答案不完整或有误时不得照错；给出正确标准答案，保留 `bookRaw` 并说明 `notes`。
6. 能用确定性方法判定的题标记 `grading: "auto"`，拆成一个或多个 `parts`。
7. 作图、证明、开放说理等当前无法可靠自动判定的题标记 `grading: "ungraded"`。
8. `ungraded` 仍必须提供 `displayAnswer`。用户提交完成后不显示对错，只显示“该题不判定正误”和标准答案。
9. 当前运行时不调用 LLM 判题；LLM 只在 cap2 的离线生产阶段生成缺失标准答案。
10. 现代版改了人物、地点、单位或年份时，`displayAnswer` 和单位必须跟随现代题面；
   `bookRaw` 仍原样保留，不能反向污染原始答案。

稳定产物为每个 lesson 一份：

```text
resources/s10y-lessons/<book>/editions/<edition>/lessons/<lesson-id>/answer-keys.json
```

```json
{
  "schema": "ld-s10y-answer/lesson-answers@1",
  "book": "5m",
  "lesson": "math5-c1-s1-n1",
  "edition": "modern-us-neutral",
  "status": "ready",
  "answers": [
    {
      "exercise": "14",
      "grading": "auto",
      "source": "book",
      "bookRaw": "1) 38 194；2) 14 704；3) 90.55；4) 36.4",
      "displayAnswer": "1) 38 194；2) 14 704；3) 90.55；4) 36.4",
      "parts": [
        {"label": "1)", "judge": "numeric", "expected": ["38194"]},
        {"label": "2)", "judge": "numeric", "expected": ["14704"]},
        {"label": "3)", "judge": "numeric", "expected": ["90.55"]},
        {"label": "4)", "judge": "numeric", "expected": ["36.4"]}
      ]
    }
  ]
}
```

`judge` 当前只允许：

- `exact`：规范化后的文本必须匹配 `expected` 中任一项。
- `numeric`：数值等价。
- `expression`：数学表达式等价。

cap2 产物必须通过 [gate-2-lesson-answers](references/gate-2-lesson-answers/gate.md)，再
`finalize` 和真实 `publish`。发布器会验证答案审计和数据库课程的 edition 完全一致；
原始 lesson 或不同 edition 均拒绝写入。`--dry` 只能检查，不能作为交付终点。
