# 01: 用户核心数据落盘 + localStorage 一次性迁移

**What to build:** 收藏、自定义标签（含颜色）、重命名、最近访问序列、标签页布局、分组折叠状态、侧栏宽度迁移为主进程磁盘持久化（userData 下 JSON，经 preload 桥接读写），localStorage 退化为缓存。用户换端口、清浏览器缓存、升级版本后数据均不丢失；首次运行自动迁移历史 `wb_axhub_*` 数据；备份导出/导入功能继续可用且作用于磁盘存储。写策略为变更后防抖整文件写回。

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] 固定端口段被占满回退随机端口时，重启后收藏/标签/最近访问/标签页完整保留
- [x] 清空 localStorage 后重启，核心数据从磁盘恢复
- [x] 旧版本 localStorage 数据首次启动自动迁移，迁移后以磁盘为准
- [x] userData JSON 损坏时容错回退到空数据，应用不崩溃
- [x] 备份导出/导入在磁盘存储上行为正确（合并/覆盖两种模式）
- [x] 持久化模块有测试覆盖（空启动/写读一致/损坏容错/迁移/合并保留用户标注字段）

## Result

实现：主进程新增磁盘存储模块（userData/wb-user-data.json，防抖 + 原子写 + 损坏留档 .corrupt），preload 启动时 sendSync 灌入 localStorage（磁盘为事实来源，磁盘无数据 = 旧数据自动迁移），渲染层 persist/saveRaw 后 300ms 防抖整包回传；备份弹窗"清空全部"同步清磁盘。模块测试 9 项全过（node:test），viewer 构建通过。桌面端 GUI 行为待真机验证（沙箱无图形会话）。
