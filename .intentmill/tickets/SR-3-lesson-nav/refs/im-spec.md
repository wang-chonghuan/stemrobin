# IntentMill Spec

## Intent

课文页(`/lesson/$id`)为学习者提供"上一课 / 下一课"导航,按课程表(CURRICULUM)顺序在有课文页的课之间切换,读完一课无需回到目录即可进入相邻的课。

## Scope

- 在 `src/routes/_app/lesson.$id.tsx` 的课文内容底部新增上一课/下一课导航控件。
- 在 `src/lib/curriculum.ts` 新增派生前后课条目的纯函数(以现有 `AVAILABLE_LESSONS` 为唯一顺序来源)。
- 为该纯函数新增 vitest 单测。
- 必要时在 `src/styles/app.css` 内用现有 `--sr-*` token 增加导航行布局样式。

## Non-Scope

- 不改变课文 HTML 内容渲染(`LessonFrame`/iframe 逻辑、`getLessonHtml`/`getLessonPdf` 不动)。
- 不改动目录侧栏(`src/components/catalog.tsx`)与首页列表(`src/routes/_app/index.tsx`)。
- 不新增键盘快捷键;不记录学习进度。
- 不为无 `id` 的纲要占位课生成页面、路由或导航目标。
- 传记章节页(`/story/$id`)不加导航(grill G4 拒绝项;另立工单)。
- 不引入新的顺序数据结构(拒绝第二 SSOT)、新依赖、新颜色/组件原型、新 DB/API/配置。
- 顶栏放置导航、隐藏式(控件消失)边界处理为 grill 拒绝项,不得出现。

## Requirements

- R1 顺序契约:导航序列 = `src/lib/curriculum.ts` 的 `AVAILABLE_LESSONS`(CURRICULUM 展平后仅含有 `id` 的课,跨阶段/学科连续)。无课文页的课永不作为导航目标。
- R2 上一课:打开任意非首个有页面课的课文页,课文底部可见"上一课"控件,点击跳转到 `AVAILABLE_LESSONS` 中前一条目的 `/lesson/$id`。
- R3 下一课:打开任意非末个有页面课的课文页,课文底部可见"下一课"控件,点击跳转到后一条目的 `/lesson/$id`。
- R4 边界:首个有页面课的"上一课"、末个有页面课的"下一课"以禁用态呈现——控件保留、不可点击、降透明度(沿用 `.sr-icontool:disabled` 的视觉先例);布局左右稳定。
- R5 未知 id:`$id` 不在 `AVAILABLE_LESSONS` 中时(手输 URL 等),两个导航控件均不渲染。
- R6 位置与排布:导航行位于 `.sr-d-scroll` 内、`LessonFrame` 之后(无 html 时的占位文案之后同理),上一课居左、下一课居右。
- R7 控件内容:方向文案 + 目标课编号标题,标题由现有 `getLessonLabel` 生成(例:"下一课"方向 + "2.5 同类项与合并");禁用态控件只显方向文案(无目标课)。
- R8 UI 语言与设计:文案为中文("上一课"/"下一课");视觉遵循 DESIGN.md——`.sr-btn ghost` 按钮形态(透明底、`--sr-line` 边框、`--sr-panel` hover)、lucide 细描边 Chevron 图标、现有 `--sr-*` token,不新增色值;焦点态沿用全局 focus-visible 规则。
- R9 跳转方式:使用 `@tanstack/react-router` 的 `Link to="/lesson/$id" params`(与 catalog 一致的客户端导航),路由 loader 照常为新课拉取 HTML。

## Critical Existing Contracts

- `AVAILABLE_LESSONS`(src/lib/curriculum.ts)已被首页 `src/routes/_app/index.tsx` 消费(列表与计数),其导出形状 `{ id, title, subject }[]` 与顺序不得改变。
- `getLessonLabel(id)` 的现有行为(编号+标题、未匹配时回退 id)不得改变,导航控件按现状复用。
- 课文页路由 loader 契约:`loader` 按 `params.id` 调 `getLessonHtml`,组件用 `Route.useLoaderData()`;导航必须经由路由跳转触发 loader,不得绕过(如自行 fetch/swap HTML)。
- `LessonFrame` 的 iframe 高度自适应逻辑(ResizeObserver + 定时补测)不得改动。
- 顶栏现有控件(返回 / 卡片答题 / 下载 PDF)与 `QuizDrawer` 行为不变。
- vitest 隔离配置契约:`vitest.config.ts` 仅收 `src/**/*.test.ts` 纯模块,不加载 TanStack Start vite 插件;新增测试必须符合该 glob,不得改动 vitest 配置。

## Confirmed Decisions

来自 im-grill.md Blocking Decisions(cap13 代裁决,均为 proxy decisions):

- G1:导航放课文底部——`.sr-d-scroll` 内、`LessonFrame` 之后的页脚行,上一课居左、下一课居右。
- G2:首/末边界呈禁用态(保留控件、不可点击、降透明度),不采用隐藏。
- G3:控件显示方向文案 + 目标课编号标题(复用 `getLessonLabel`)。
- G4:传记页(/story/$id)本工单不动。

采纳的 Recommended Defaults:顺序 SSOT 复用 `AVAILABLE_LESSONS` 并新增纯函数 helper;未知 id 不渲染控件;跨阶段/学科按展平顺序连续;`Link` 客户端导航;`.sr-btn ghost` + lucide Chevron;组件 JSX 不做 vitest 测试,以纯函数单测 + playwright 真浏览器验证覆盖 UI。

Future/Conditional(不影响本工单):未来其他学科课文页上线后如需按学科分段导航,另行决策;移动端(<860px)导航行允许换行。

## Compatibility And Regression Constraints

- 首页 `index.tsx` 对 `AVAILABLE_LESSONS` 的消费(数量徽标、课卡列表)不得回归。
- 目录侧栏、首页、传记页、登录页的渲染与行为不变。
- 现有单测 `src/lib/answer-normalize.test.ts` 继续通过;`npm run test`、`npm run build` 全绿。
- 课文页对已有 6 个课(math-s2-03…math-s2-08)的内容渲染、PDF 下载、卡片答题不回归。

## Open Questions

None.
