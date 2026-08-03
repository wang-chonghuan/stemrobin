# im-spec — STEMROBIN-117 默认界面语言改为中文

> Express lane：本文件是工单三段的机械转写，不是新的撰写。来源 = STEMROBIN-117 冻结的描述。

## Intent

首次访问的访客，以及从未切换过语言的用户，产品落地页、学习首页、课文页与习题页的界面文案都是英文，而课程正文、题目、图注和标准答案全部是中文，同一屏里两种语言并存。

## Scope

在学习者没有表达过语言偏好时，界面默认以中文呈现，与内容语言一致；已经主动选择过语言的用户不受影响，仍按其选择呈现。

## Requirements

1. 清除浏览器 cookie 后打开产品落地页与学习首页，界面文案为中文。
2. 手动切换到英文并刷新，界面仍为英文；再次清除 cookie 后重新打开，界面回到中文。

## Confirmed Decisions

- 语言切换控件与语言偏好的记忆机制保持现状，行为不得改变。
- 英文仍是可选语言，不得移除或隐藏。

## Non-Scope

- 不得改动任何课程内容数据。
- 不得引入任何新依赖。

## Critical Existing Contracts

- 语言偏好是一个非 httpOnly 的长效 cookie `sr_locale`，由服务端解析，SSR 与首屏必须同语言（无闪烁）。
- `DEFAULT_LOCALE` 同时是「无 cookie 时的回退」与「setLocale 收到非法值时的回退」，两处共用同一常量。
- 目录可用性投影按 locale 过滤：中文显示完整大纲，英文只显示已翻译课程。改默认语言会改变未登录首屏看到的目录形态。

## Compatibility And Regression Constraints

- 已存在 `sr_locale=en` cookie 的用户，行为必须完全不变。
- `<html lang>` 必须随 locale 一起变，不得停留在 en。

## Open Questions

None.
