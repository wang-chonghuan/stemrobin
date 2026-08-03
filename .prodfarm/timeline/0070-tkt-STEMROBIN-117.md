# 0070 tkt STEMROBIN-117

- kind: tkt
- batch: 0016-practice-input
- ticket: STEMROBIN-117
- type: fix
- lane: express（步骤 6 对真实 diff 复检六条谓词，全部成立，未改道）
- merge: PR #32 → main 2b97460
- deploy: acreasyapp.azurecr.io/stemrobin:latest，ca-stemrobin 已更新并实测

## What shipped

界面默认语言由英文改为中文。`DEFAULT_LOCALE` 是「无 `sr_locale` cookie 时的回退」与
「`setLocale` 收到非法值时的回退」共用的唯一常量，`<html lang>` 与全部 `t(locale, …)`
都是它的下游，所以只改这一个值，语言切换链路与偏好记忆一律未动。反转 STEMROBIN-111。

## Evidence

- worktree 实测：清空 cookie 后 `/` 与 `/learn` 均为中文、`<html lang>=zh-CN`；经界面语言
  菜单切到 English 后刷新仍为英文；再清 cookie 回到中文。工单级 Playwright 2/2。
- vitest 75/75。
- 部署后实测 `https://lemmadeck.com/` 首字节即 `<html lang="zh-CN">`。

## Decisions

- `<title>` 与 `description` 保持英文。它们是搜索引擎索引的文案，属于与「学习者阅读语言」
  不同的一个决定，本工单没有携带它，因此显式不做，并把理由写进了源码注释。这是「在飞工单
  不得扩张范围」的执行，不是遗漏。

## Notes

- n-easyapp 的 redeploy 脚本会把工作区里所有未提交改动自动 commit 后再构建。本次它把另一个
  会话遗留的 `README.md` 修改扫进了 `37665ac chore(deploy): redeploy stemrobin`。内容本身是
  对的（README 更新为「AI 只参与视觉转写与受约束改写」的口径），但提交信息与内容不符。
  登记在此，不在批内修正。
