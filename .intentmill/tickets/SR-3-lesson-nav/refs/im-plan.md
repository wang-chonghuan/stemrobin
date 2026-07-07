# IntentMill Plan

## Source Contract

`im-spec.md` 是唯一需求契约。`im-draft.md` 与 `im-grill.md` 仅为背景来源,其实质约束已全部提升进 spec/plan,cap6 无需回读。

## Implementation Approach

- `src/lib/curriculum.ts`:文件末尾新增导出的纯函数 `getLessonNav(id: string)`,在 `AVAILABLE_LESSONS` 中查 `id` 的索引,返回 `{ prev, next }`(各为 `{ id, title, subject }` 条目或 `undefined`;索引 -1 时两者均 `undefined`)。不改动 `CURRICULUM`、`getLessonLabel`、`AVAILABLE_LESSONS` 的任何现有导出形状(spec Critical Contracts)。
- `src/routes/_app/lesson.$id.tsx`:在 `.sr-d-scroll` 内、内容(iframe 或占位文案)之后渲染导航行组件(本文件内的小函数组件即可,不新建文件):
  - 组件内调 `getLessonNav(id)`;`prev` 与 `next` 均为 `undefined`(未知 id,spec R5)时整行不渲染。
  - 有目标:`Link to="/lesson/$id" params={{ id }}` + `className="sr-btn ghost"`,内容为 ChevronLeft/`上一课` 与目标 `getLessonLabel(prev.id)`(下一课镜像,ChevronRight 居右)。
  - 无目标但 id 在列表内(首/末,spec R4):渲染禁用态控件(非链接,如带 `disabled` 的 button 或 aria-disabled 样式元素),只显方向文案,视觉沿用 opacity 0.55 先例。
  - 排布:flex 行,上一课居左、下一课居右(justify-content: space-between),内边距与 20px 内容 padding 对齐(`.sr-d-scroll` 该页 padding 为 0,导航行自带 padding)。允许 flex-wrap 以兼容 <860px。
- `src/styles/app.css`:仅在行内 style 不足以表达 hover/disabled 状态时,追加一个小节(如 `.sr-lesson-nav`)——只用现有 `--sr-*` token。
- 测试:新增 `src/lib/curriculum.test.ts`(命中 vitest include glob,零配置改动)。

## Implementation Drift Controls

- 不得改动 `AVAILABLE_LESSONS`、`getLessonLabel`、`CURRICULUM` 的导出形状/顺序/行为——首页 `index.tsx` 是现存消费者。
- 不得新建第二份课程顺序数据;顺序只能派生自 `AVAILABLE_LESSONS`。
- 不得绕过路由 loader(禁止自行 fetch HTML 换内容);跳转只用 `Link`。
- 不得触碰 `LessonFrame`、`QuizDrawer`、PDF 下载、顶栏控件、catalog.tsx、index.tsx、story.$id.tsx。
- 拒绝项不得复活:顶栏放置、边界隐藏式处理、传记页导航、键盘快捷键、学习进度。
- 不改 `vitest.config.ts`、不加 jsdom/RTL 依赖;组件 UI 由 playwright 真浏览器验证覆盖(强制,UI 变更)。
- 文案、token、组件形态严格按 spec R7/R8;不新增色值或组件原型。若实现时发现 spec 要求无法表达(如禁用 Link 语义),fail fast 记入 im-handoff.md,不得静默降级。

## Phases

1. **纯函数 + 单测**:在 `src/lib/curriculum.ts` 加 `getLessonNav`;写 `src/lib/curriculum.test.ts`(用例见下)。验证点:`npm run test` 全绿(含既有 answer-normalize 测试)。
2. **课文页导航行**:编辑 `src/routes/_app/lesson.$id.tsx` 渲染导航行(含禁用态、未知 id 不渲染);如需追加 `.sr-lesson-nav` 样式则改 `src/styles/app.css`。验证点:`npm run build` 通过;`npm run dev` 下肉眼检查中间课/首课/末课/未知 id 四种页面。
3. **真浏览器验证(playwright,UI 变更强制)**:登录后打开 math-s2-05(中间课)验证两控件可见且点击跳转正确;math-s2-03(首课)验证上一课禁用、下一课可用;math-s2-08(末课)验证镜像;未知 id(如 math-s2-99)验证无导航行;截图存 `.intentmill/tickets/SR-3-lesson-nav/tests/`。回归检查:首页课卡列表、目录侧栏、课文 iframe 渲染、顶栏控件不变。
4. **收尾**:写 `.intentmill/tickets/SR-3-lesson-nav/tests/test-results.md` 与 `refs/im-handoff.md`;跑 gate6。

## Unit Test Plan

位置:`src/lib/curriculum.test.ts`(源码旁,符合 vitest glob;`.intentmill/tickets/SR-3-lesson-nav/tests/` 存 test-results.md 与浏览器验证证据)。命令:`npm run test`。

用例(以 `AVAILABLE_LESSONS` 实际内容为基准,不硬编码具体课 id 以外的假设):

- 中间条目:`getLessonNav(AVAILABLE_LESSONS[1].id)` 返回 prev=第 0 条、next=第 2 条(顺序契约 R1/R2/R3)。
- 首条目:prev 为 undefined、next 为第 1 条(R4)。
- 末条目:next 为 undefined、prev 为倒数第 2 条(R4)。
- 未知 id(`'math-s2-99'`、`''`):prev/next 均 undefined(R5)。
- 顺序契约回归:`AVAILABLE_LESSONS` 每一项都有非空 id,且顺序与 CURRICULUM 展平(仅含 id 课)一致——防止 helper 引入第二顺序源(R1、拒绝项守卫)。
- 消费者回归:`getLessonNav` 不改变 `AVAILABLE_LESSONS`(纯函数,无副作用断言:调用前后数组引用与长度不变)。

组件渲染/点击跳转无法 vitest 覆盖(无 jsdom/RTL,vitest 配置契约禁止改动)——由 Phase 3 playwright 真浏览器验证覆盖 R2/R3/R4/R5/R6/R7/R8 的 UI 侧,并留存截图证据。

## Handoff Expectations

cap6 完成后写 `refs/im-handoff.md`:按 文件/模块 粒度总结实际改动;声明实现与 im-spec.md / im-plan.md 是否有偏差及原因;列出本应更早 grill 的遗漏评审点;记录 Residual Issues 与未来改进(含 grill Future/Conditional 项的去向)。不得为新决策回到 cap4。
