# 0044 tkt STEMROBIN-51
- kind: tkt
- ticket: STEMROBIN-51
- type: enabler
- batch: 0009-figure-aware-lessongen
- merge_commit: f0c8771
- seed: STEMROBIN-49
- consumes: []
## 摘要
蓝图优先流水线 + 图规格 + 去图预设。核心：表示形式跟内容的认知需求走，不预设代数/几何、不设数量下限。新增 check-blueprint.mjs（**授权前的门**）：蓝图声明 domain+理由 + 每节图计划，门对**无 why 的图判失败（废图）**——按必要性而非计数；几何蓝图带被证成的图、代数蓝图 0 图也过。图规格入 content（body 节点 {kind:svg, spec}），render-lesson 经 figure.mjs 渲成 correct-by-construction SVG；check-content 校验 spec + **图-文一致性**（图标签须出现在该卡文中，否则装饰性→fail），raw svg 仍允许。契约/capability/SKILL 删掉“概念课 model 固定一张图”预设，加“## Figures（必要性）+## Blueprint（先规划后检）”与蓝图 step-0。验收：蓝图门放行被证成的几何计划、拦截无 why 图、放行 0 图的代数计划；spec 渲进 html；既有 raw-svg 课无回归。仅改 skill、app/未动→无需重部署。合并 f0c8771 直推 main。
