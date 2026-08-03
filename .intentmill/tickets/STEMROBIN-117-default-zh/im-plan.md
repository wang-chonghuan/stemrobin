# im-plan — STEMROBIN-117

来源契约：`im-spec.md`（express 转写）。

## 实现思路

默认 locale 是单一常量，`locale.server.ts`（无 cookie 回退）与 `locale.ts`（非法值回退）都从它取值，`__root.tsx` 的 `<html lang>` 与全部 `t(locale, …)` 调用都是它的下游。因此只改这一个常量即可，不新增分支、不改切换链路。

## Phases

1. 把默认 locale 常量由 `en` 改为 `zh`，并更新其注释所引用的决策来源。

## Unit Test Plan

Express 的测试义务是一份工单级 Playwright 脚本，断言与验收标准 1:1：
- AC1 → 无 cookie 打开 `/` 与 `/learn`，断言可见中文文案、`<html lang>` 为 `zh-CN`。
- AC2 → 通过语言菜单切到 English 后重载，断言仍为英文；清 cookie 重开，断言回到中文。
脚本：`app/tests/tickets/STEMROBIN-117-default-zh.spec.ts`，带截图。

## Handoff Expectations

worktree 内 `npm run test` 绿、Playwright 脚本 2 条断言全过、截图留存。不合并、不部署。
