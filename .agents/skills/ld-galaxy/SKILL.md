---
name: ld-galaxy
description: 重建或更新首页"知识星图"（knowledge galaxy）——把 toc 里全部数学/物理/概率知识点经中文 embedding + UMAP + KMeans 生成语义星空数据 galaxy.json，并用仓库自带 Playwright 验证渲染。当目录（ssot-resources toc）新增/修改了书册、章节、知识点，或需要调整星图聚类、命名、配色时使用。
---

# ld-galaxy

首页 hero 行下方的全宽 2.5D 星空（`app/src/components/knowledge-galaxy.tsx`）不是装饰图：
每颗星是 toc 里的一个真实知识点，位置由**语义 embedding 降维**决定——相近的知识点真的
靠在一起，数学/物理/概率各自成星域，交界处（三角比↔几何光学）真实相邻。本技能负责在
目录变化后重新生成它的数据文件 `galaxy.json`，并验证前端渲染。

## 架构一句话

**运行时零计算**。布局、聚类、命名全部离线预计算成一份静态 JSON（~520KB），前端只做
渲染 + 交互。永远不要把力导向模拟或聚类搬进浏览器——那是这个设计最初就否决的方案。

## 文件地图

| 路径 | 作用 |
|---|---|
| `ssot-resources/soviet10year-textbooks/toc/<bookId>/{zh,en}.json` | 数据源（zh 权威，en 只译标题） |
| `prototypes/knowledge-galaxy/pipeline/extract.py` | toc → `out/nodes.json`（含 embedding 文本） |
| `prototypes/knowledge-galaxy/pipeline/embed_layout.py` | embedding → UMAP 2D → KMeans → `out/layout.json`，并**打印每簇样本**（命名的唯一依据） |
| `prototypes/knowledge-galaxy/pipeline/build_galaxy.py` | 簇命名（NAMES/NAMES_EN）+ 无内容节点过滤 + 枢纽边 → 同时写 `prototypes/.../web/galaxy.json` 和 `app/public/galaxy.json` |
| `app/src/components/knowledge-galaxy.tsx` | 前端组件：颜色配置（顶部 `COLORS`）、双语 `STRINGS`、懒加载、交互 |
| `prototypes/knowledge-galaxy/web/` | 独立原型页（three.js importmap），调视觉参数时用，`launch.json` 配置名 `galaxy-prototype`（端口 8765） |

## 重建流程（每一步都必须做，顺序不能换）

### 0. 环境

管线的 venv 建在会话 scratchpad（临时目录），大概率已不存在，直接重建：

```bash
python3 -m venv "$SCRATCHPAD/venv"
"$SCRATCHPAD/venv/bin/pip" install -q sentence-transformers umap-learn scikit-learn
```

macOS 的 torch wheel 不大（无 CUDA），全套约几百 MB。embedding 模型 `BAAI/bge-small-zh-v1.5`
（~100MB）首跑自动从 HF 下载；如果拉不动，设 `HF_ENDPOINT=https://hf-mirror.com`。

### 1. 提取 — 新学科必须先登记

```bash
cd prototypes/knowledge-galaxy/pipeline && $VENV/bin/python extract.py
```

**新增的书如果引入了新 `subject` 值，extract.py 的 `BRANCH` 字典必须先加条目**
`(discipline, 中文分支名)`，否则 KeyError。学科归属（math/physics）以
`app/src/lib/textbooks.ts` 的 `BRANCH` 为准——两处要一致（例：`probability` 归 math）。
概率论两册没有 topic 级，节（section）即节点，这是正常的，`cardsOf` 语义如此。

### 2. 布局与聚类

```bash
$VENV/bin/python embed_layout.py <K>
```

K 的经验值：**每 ~28 个内容节点一个簇**（1249 节点 → 47）。节点数明显变了就按比例调 K。
输出会打印全部 K 个簇的 top 样本标题——**保存这份打印，下一步全靠它**。

### 3. 簇命名 — 本管线最脆弱的一步，没有捷径

`build_galaxy.py` 里的 `NAMES` / `NAMES_EN` 按 **KMeans 簇号**索引。**embedding 文本
只要有任何变化（新增节点、改模板、去重修补），全部簇号都会重排**，旧名字会张冠李戴
——症状是打印出来的"跨学科边"名字荒谬（如 电磁现象↔小数与百分数）。已经栽过一次：
只改了上下文去重逻辑，44 个名字全部错位。

所以：**凡是重跑了 embed_layout，必须对照第 2 步的打印逐簇重写 NAMES 和 NAMES_EN，
一个都不能沿用旧的**。命名要求：2–8 个字的中文概念名 + 对应英文（Title Case），同批
不重名，物理/数学口径与教材一致（看样本里的实际标题定名，别猜）。

### 4. 生成 galaxy.json

```bash
$VENV/bin/python build_galaxy.py
```

脚本自动：过滤无内容节点（标题含 练习/复习题/习题/问题解答/小结/提要/引言/附录 或
en 对应词——这些**连星尘都不当**，是用户的明确决定）；每枢纽取质心余弦 top-3 邻边 +
跨学科 top-6；**同时写两份** galaxy.json（原型 + app/public）。检查打印的
`stars/hubs/dropped/{math,physics}` 计数和跨学科边名字是否讲得通。

### 5. 验证 — 用仓库自己的 Playwright，别用别的

**不要用 Claude Browser pane 做测试结论**（它的 IntersectionObserver 会假不触发，在
生产站上产生过"懒加载坏了"的假阴性，实际站点完全正常——用户明确要求改用 autoqa 方法）。
**也不要用 playwright-test MCP 的 setup_page**（MCP 自带的 @playwright/test 与仓库的
1.61 双版本冲突，起不来）。

正确做法：往 `app/tests/` 放一个一次性 spec（模板在本技能 `references/verify-template.spec.ts`，
把三处 `EXPECTED_*` 换成第 4 步打印的真实数字），然后：

```bash
cd app && npx playwright test tests/galaxy-verify.spec.ts --reporter=list
```

四个 project（chromium/chrome/firefox/webkit）应全绿。它断言：canvas 出现（懒加载成功）、
枢纽标签数 = K、指定枢纽名在列、`/galaxy.json` 的 stars/hubs/分支计数精确匹配，并截图。
跑完**删除 spec 和 test-results/**，不要留在仓库里。前提：dev server 在 3200
（launch.json `stemrobin-dev`；别的会话开着也能直接用，public/ 下的 galaxy.json 是磁盘直读）。

## 前端侧知识（改视觉/交互时看）

- **颜色**：`knowledge-galaxy.tsx` 顶部 `COLORS`。当前定版：**数学金 `#ffc46b`、物理蓝
  `#6bc8ff`**——数学是主打学科，金色在暗底上视觉权重更大，这是用户来回对比后的决定，
  别擅自换回去。星点/枢纽/连线/标签/图例全部从这一处派生。
- **双语**：英文默认。知识点/册/章标题用 toc en.json 现成翻译；枢纽英文名来自
  `NAMES_EN`；组件内 `STRINGS` 管提示语，不进全局 i18n 表。
- **性能红线**：three 只能经组件 useEffect 里的动态 `import()` 进来（IntersectionObserver
  入视口才加载）。主 chunk 592KB 不许涨；`npm run build` 后确认 three 是独立 chunk。
  服务端产物里出现 `_libs/three.mjs` 是打包器发射的死代码，SSR 不执行，无害。
- **交互契约**：普通滚轮永远交给页面（enableZoom=false）；缩放=捏合/⌘+滚轮；右键拖平移；
  点击任意星居中（点击命中要**当场投影计算**，不能依赖上一帧 hover 状态——合成点击会
  在帧间到达）；居中目标先 `clampToDisc` 再滑动，否则相机在边界上无限漂移。
- **标签三层披露**：枢纽常驻（屏幕空间防碰撞，大簇优先）；知识点标签只在镜头推近时
  按视野中心渐显（≤30 个）；与所属枢纽同名的知识点不出标签。
- **UMAP 随机性**：重跑后星域可能整体镜像/旋转（数学从右变左），无害。介意的话在
  embed_layout 归一化后加一步定向（如按数学质心固定在 +x 侧翻转）。

## 已知坑（都真实发生过）

1. **npm install 裁 lockfile**：mac 上装依赖后 `@esbuild/*` 平台条目被清空。经 Docker
   linux 构建实证无害（vite 8 走 rolldown），别为此回滚 lockfile。
2. **`npx tsc` 偶尔解析到假 tsc 包**，用 `./node_modules/.bin/tsc --noEmit`。
   `textbooks.ts:193` 有一个与星图无关的既有类型错误，忽略。
3. **HMR 对 canvas 组件不可靠**：改了组件感觉没生效时，先硬刷新再排查。
4. 上线需要 commit + push（n-git cap11）+ 重新部署（n-easyapp cap2，项目名 `stemrobin`）；
   galaxy.json 走镜像里的 `app/public/`，不改数据库。

## 明确排除 / 未来方向

- 边只有"枢纽间语义相似"，**没有真正的前置依赖 DAG**——toc 里不存在这种数据。二期
  方案（已调研未做）：LLM 给每个知识点富化 2–3 句描述再 embedding（治跨学科桥弱 +
  可顺带自动命名簇，消灭上面第 3 步的手工），kNN 候选 + LLM 判前置方向 + DFS 环检测；
  参照公开数据集 K12-KGraph（HuggingFace `lhpku20010120/K12-KGraph`，人教版 K12，
  6.5k 概念 3.7k 前置边）交叉校验。
- 不要给 embedding 文本里的学科前缀加权重——它已经把数学/物理推得偏开，跨学科边
  因此偏弱，这正是二期富化要解决的。
