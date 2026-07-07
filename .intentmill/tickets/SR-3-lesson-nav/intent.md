课文页支持上一课/下一课导航

## Scope
在课文页(lesson 页)为学习者提供"上一课 / 下一课"导航,按课程表(CURRICULUM)顺序在**有课文页的课**之间切换。学习者读完一课后无需回到目录即可进入相邻的课。建议(不构成义务):导航控件放在课文底部更贴近读完场景。

## Out of scope
不改变课文内容的渲染;不改动目录页;不新增键盘快捷键;不记录学习进度;无课文页的课(纲要占位课)不参与导航,也不为它们生成页面。

## 约束
None

## 完成判据
- 打开任意一个非首个"有页面课"的课文页,可见"上一课"控件,点击后跳转到课程表顺序中前一个有页面的课。
- 打开任意一个非末个"有页面课"的课文页,可见"下一课"控件,点击后跳转到后一个有页面的课。
- 课程表顺序中第一个有页面的课不显示"上一课"(或呈禁用态),最后一个有页面的课不显示"下一课"(或呈禁用态)。

## 项目上下文(来自 product wiki,intent 生成时内联)
- 技术栈:tanstack-start(SSR 单 app),React 19,TS,@tanstack/react-router 文件路由(src/routes/),Tailwind 4,zustand,postgres 客户端,vite/vitest。
- 架构:课文页路由 src/routes/_app/lesson.$id.tsx(HTML iframe + PDF 下载);课程表 src/lib/curriculum.ts 导出 CURRICULUM(subjects→stages→lessons,课有 id 才有页面);目录侧栏 src/components/catalog.tsx。
- 命令(repo 根):npm run dev(vite dev,端口看输出,默认 3000);npm run test(vitest);npm run build。
- UI 语言:界面文案用中文(产品面向中文儿童学习者)。
