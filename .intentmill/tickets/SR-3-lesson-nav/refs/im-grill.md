# IntentMill Grill

## Blocking Decisions

1. id: G1
   question: 上一课/下一课控件放在哪里?intent 建议课文底部但明确不构成义务,顶栏已有 返回/卡片答题/下载PDF 三个控件。
   recommendation: 放在课文底部——`.sr-d-scroll` 内、`LessonFrame` 之后的一行页脚导航(上一课居左、下一课居右)。这是 MDN/Docusaurus/GitBook 等顺序阅读产品的主导 pager 模式,贴合"读完进入下一课"场景;顶栏在移动端(<860px)已经拥挤。
   final_decision: 放在课文底部,`.sr-d-scroll` 内、`LessonFrame` 之后的页脚导航行,上一课居左、下一课居右。[cap13 代裁决/proxy decision;依据:工单 Scope 自带建议"导航控件放在课文底部更贴近读完场景"(tier 2),spec 层(architecture.md/features/lesson-page.md)对摆放位置无规定,采 n-im 推荐默认(tier 3,MDN/Docusaurus pager 模式)落实该建议]

2. id: G2
   question: 课程表顺序中第一个有页面的课的"上一课"、最后一个的"下一课",隐藏还是呈禁用态?完成判据两者皆可。
   recommendation: 呈禁用态(保留控件、降透明度、不可点击),布局左右稳定,学习者能感知"到头了"——对儿童学习者比控件凭空消失更明确;Kindle/微信读书章节导航同此模式。repo 已有禁用样式先例(`.sr-icontool:disabled`,opacity 0.55)。
   final_decision: 呈禁用态(保留控件、不可点击、降透明度)。[cap13 代裁决/proxy decision;依据:工单完成判据明示两者皆可("不显示……或呈禁用态",tier 2 无唯一答案),spec 层无规定,采 n-im 推荐默认(tier 3):禁用态,沿用代码先例 src/styles/app.css `.sr-icontool:disabled`]

3. id: G3
   question: 导航控件只显示"上一课/下一课"方向文案,还是同时显示目标课的编号标题(如"2.5 同类项与合并")?
   recommendation: 同时显示目标课编号标题,复用 `getLessonLabel`。MDN/Docusaurus pager 与 Khan Academy 均展示目标标题,让学习者点击前知道去哪一课;符合 DESIGN.md"直接、具体"的文案基调。
   final_decision: 方向文案 + 目标课编号标题(复用 `getLessonLabel`,如"下一课 · 2.5 同类项与合并")。[cap13 代裁决/proxy decision;依据:spec 层与工单对控件内文均无规定(tier 1/2 沉默),采 n-im 推荐默认(tier 3,MDN/Docusaurus/Khan 目标标题模式,符合 DESIGN.md Content Tone"直接、具体");不越出 Scope——仍是同一导航控件的内容]

4. id: G4
   question: 名人传记章节页(/story/$id)今天没有上一章/下一章导航,本工单为课文页加 pager 后会形成跨功能不一致。确认传记页保持不动、留待后续工单?
   recommendation: 确认保持不动。传记不在 CURRICULUM 内,intent 的"按课程表顺序"规则不适用;intent Scope 仅覆盖课文页(lesson 页)。如需传记章节导航应另立工单。
   final_decision: 确认传记页(/story/$id)本工单不动;如需章节导航另立工单。[cap13 代裁决/proxy decision;依据:工单 Scope 仅覆盖课文页(lesson 页)(tier 2);fact 层 .prodfarm/features/story-page.md 将传记页登记为独立 feature(source ticket SR-2),为其加导航会改动另一 story 的承诺,超出本工单裁决边界(tier 1)]

## Recommended Defaults

- 导航序列 SSOT:复用 `src/lib/curriculum.ts` 的 `AVAILABLE_LESSONS`(CURRICULUM 展平后仅含有 `id` 的课),新增纯函数 helper(如 `getLessonNav(id)`)返回前后课条目;不建立第二份顺序数据。
- URL 手输的未知 id / 不在 `AVAILABLE_LESSONS` 的 id:两个控件都不出现(该页本身显示"课程内容尚未生成。"),与"无课文页的课不参与导航"一致。
- 导航跨阶段、跨学科按 CURRICULUM 展平顺序连续——由 intent"按课程表(CURRICULUM)顺序在有课文页的课之间切换"直接决定(当前 6 个有页面课全在数学第 2 阶段,暂无实际跨界)。
- 跳转用 `@tanstack/react-router` 的 `Link to="/lesson/$id" params`,与 `src/components/catalog.tsx` 现有模式一致;路由 loader 照常拉取新课 HTML。
- 视觉:`.sr-btn ghost` 按钮 + lucide ChevronLeft/ChevronRight 细描边图标,全部使用现有 `--sr-*` token(DESIGN.md Buttons/Icons 节);焦点态沿用全局 focus-visible 规则;不新增颜色或组件原型。
- R-TEST:vitest 仅收 `src/**/*.test.ts` 纯模块、无 jsdom/RTL——组件 JSX 不做 vitest 测试;以 `src/lib/curriculum.test.ts` 单测 nav helper(中间/首/尾/未知 id 四类用例),UI 由 cap6 强制的 playwright 真浏览器验证覆盖。无需用户提供账号或凭证。

## Future Or Conditional Decisions

- 若未来物理等其他学科的课文页上线,"下一课"会按展平顺序从数学末课跨到物理首课;若届时产品希望按学科分段导航,另行决策。
- 若底部 pager 在移动端(<860px)展示局促,可在实现时允许换行(flex-wrap);无需现在决定专门的移动端形态。

## Out-of-Scope Guardrails

- 不改课文 HTML 内容渲染(`LessonFrame`/iframe 逻辑不动)。
- 不改目录侧栏(`src/components/catalog.tsx`)与首页列表(`src/routes/_app/index.tsx`)。
- 不新增键盘快捷键;不记录学习进度。
- 不为无 `id` 的纲要占位课生成页面或路由。
- 传记章节页(/story/$id)导航不在本工单内(G4 已确认;如需另立工单)。
