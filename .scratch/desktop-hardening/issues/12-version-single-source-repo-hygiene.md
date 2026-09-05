# 12: 版本号单源 + 仓库卫生

**What to build:** ① 主进程版本号改为从打包配置读取（app.getVersion），删除手工维护的重复常量；CLI 模式的服务自带版本常量保留。② 仓库卫生：删除误生成的垃圾文件（desktop 下名为引号的文件）、修复 gitignore 中编码损坏的失效规则、清理根目录杂物（HTTP 版 zip、server.log、预览截图酌情移入 docs 或移除）、同步 README/overview 与现状（删除"旧单文件回退"等已过时描述）。

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] 主进程与 package.json 版本永远一致（单一定义点），打包验证通过
- [x] 垃圾文件已删除，gitignore 规则真实生效（check-ignore 验证）
- [x] README/overview 与代码现状一致，无过时描述
- [x] 在线更新链路在版本号改动后实测正常（自动更新读取版本正确）

## Result

VERSION = app.getVersion() 单源；删除 desktop 下误生成引号文件与根目录 server.log；gitignore 损坏规则移除（check-ignore 恢复正常）；README 功能/结构/架构/持久化章节与现状同步。
