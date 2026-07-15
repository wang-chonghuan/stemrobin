# Batch 0006-titles-auth-cleanup — 收官报告

Seed：STEMROBIN-32（full delegation，seed 级模糊点由人裁决）· 结局：**done**（6/6 交付，无 abort）。

## 交付概要

| 单 | 类型 | 交付 | PR / merge |
|---|---|---|---|
| STEMROBIN-33 | fix | 解锁课后题（不必读完课文即可作答） | [#21](https://github.com/wang-chonghuan/stemrobin/pull/21) `b734d66` |
| STEMROBIN-34 | enabler | 恢复 section 中文名（临时脚本）+ 生成器必产 | [#23](https://github.com/wang-chonghuan/stemrobin/pull/23) `4a029c8` |
| STEMROBIN-35 | story | 卡片/速览显示课文+section 标题；速览显示课后题（只显示） | [#25](https://github.com/wang-chonghuan/stemrobin/pull/25) `48e8d53` |
| STEMROBIN-36 | story | 登录页（bare）+ 登出 | [#26](https://github.com/wang-chonghuan/stemrobin/pull/26) `a893dcd` |
| STEMROBIN-37 | fix | 从 app 代码删名人传记（保留 sr-story skill+数据） | [#22](https://github.com/wang-chonghuan/stemrobin/pull/22) `b734d66` |
| STEMROBIN-38 | fix | 英文品牌 stemrobin + 隐藏过长 slogan | [#24](https://github.com/wang-chonghuan/stemrobin/pull/24) `4a029c8` |

**最终线上**：`ca-stemrobin` rev 0000030（commit a893dcd）。六项均已上线并经生产综合验证（13/13 断言全过）。

## 核心成果（对照 seed 六点）
1. **课后题解锁**：练习随时可开可答，不因未读完课文而锁；课文/练习两进度点独立。
2. **标题恢复**：迁移丢失的 section 中文名从 STEMROBIN-21 快照恢复入 content JSONB（0 卡缺失）；生成器今后必产 section 名、删除有损回退字典。
3. **速览显示课后题**：全文速览=传统教材式，显示课文标题 + 各 section 标题 + 课后题（只显示、不判分、不计进度）。
4. **登录/登出**：登录页 bare 独立（修 31 侧栏泄漏）+ 侧边栏登出；无注册。
5. **删传记**：app 代码（侧栏/首页/story 路由/lib）彻底删；sr-story skill + 传记 DB 数据保留。
6. **英文品牌**：en=stemrobin、en slogan 隐藏；zh 不变。

## Proxy decisions（人可事后否决）
执行级 grill 全部 cap13 自裁，无 leak；逐单基据见 tkt timeline 0029–0034。seed 级模糊点由**人亲自裁决**（第1点=解锁练习 deck、第3点=速览课后题只显示），见 batch grill.md。

## 已知遗留（非阻塞）
- **STEMROBIN-35 D4**：en locale 下课文标题与 section 名仍显中文（无译文节点；课后题文本本身 locale-aware）。若要全英，需为标题/section 名加 i18n 覆盖——留后续。
- **STEMROBIN-34**：`sr_lessons.html`/`pdf` 派生缓存未重渲（app 精读/速览已从 JSONB 渲染 section 名，故不影响；但存量 html 缓存仍旧标签，将来重渲清理）；旧 `migrate-lib.htmlToCards` 若重跑会产无 name 卡（已被恢复脚本取代）。
- 前批遗留（零-readcheck 课口径、两 attempt 表、SESSION_SECRET dev fallback）仍留后续。

## 过程
- 按文件不冲突分三波并行开发（33/34/37 → 38/36 → 35），多单重叠文件（i18n/css/catalog）合并后 main 76 单测 + 构建净、生产综合验证全过。
- 34 的 section 名从 STEMROBIN-21 迁移快照恢复——正是人预判的"临时 skill 恢复"。

## Gap register 增量
无。无 abort、无前提坍塌。
