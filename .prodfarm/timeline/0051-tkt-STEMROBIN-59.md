# 0051 tkt STEMROBIN-59
- kind: tkt
- ticket: STEMROBIN-59
- type: fix
- batch: 无
- merge_commit: 918d25d
- consumes: []
## 摘要
全站换新 MynaTree 图标(resources/mynatree-logo.png 八哥即树,1254²)。从源图 sips 派生各尺寸并原名替换:logo-mark.png(256,侧栏/登录@44圆角10)、logo-mark-96(96)、favicon.png(64,标签页)、apple-touch-icon.png(180,加主屏/桌面导出)。删除废弃且过时命名的 stemrobin-logo.png。顺带修 __root.tsx 过时 description meta(科学与工程→MynaTree 数学)。验收 dev+生产:favicon/侧栏/登录均为新图、logo naturalWidth=256、apple-touch=180、构建净无 console 错误。合并 918d25d,已重部署生产实测。
