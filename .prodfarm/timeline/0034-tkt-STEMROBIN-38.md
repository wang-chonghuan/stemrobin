# 0034 tkt STEMROBIN-38
- kind: tkt
- ticket: STEMROBIN-38
- type: fix
- batch: 0006-titles-auth-cleanup
- merge_commit: 4a029c8
- seed: STEMROBIN-32
## 摘要
英文品牌 stemrobin + 隐藏过长 slogan（seed G-6）：locale-aware 品牌(zh 知更/en stemrobin)、en slogan 隐藏(不再多行难看)、zh 不变。仅 catalog.tsx。cap9：9/9 浏览器、68 单测；生产验证 zh=知更/en=stemrobin/en slogan 隐藏。无 grill-leak。
