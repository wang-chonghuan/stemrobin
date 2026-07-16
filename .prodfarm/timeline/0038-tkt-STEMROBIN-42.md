# 0038 tkt STEMROBIN-42
- kind: tkt
- ticket: STEMROBIN-42
- type: fix
- batch: 0007-reading-polish
- merge_commit: bfa5f04
- seed: STEMROBIN-39
## 摘要
卡片精读 section 标题加编号+换色（seed G-B）：'为什么学这个'→'1 为什么学这个'(card.num+name)；色 --sr-blue-deep→--sr-blue(亮 teal rgb 14,124,155)、加大加粗。仅 card-reader+css。cap9：section='1 为什么学这个'、色 rgb(14,124,155) 非黑、课文标题仍显、76 单测；生产验证通过。改 app→已重部署 rev 0000031。无 grill-leak（"全黑"实为深色 --sr-blue-deep 近黑，已改亮）。
