# 04: 全量验证、文档同步与版本收尾

**What to build:** 跑全部 node:test（serve-core 新增直接测试：穿越编码变体、Range body、302/416 描述符）；viewer 构建通过且 scan-shared 仍内联进 bundle；`npm start` 冒烟路径人工核验清单（picker/iframe/中文/媒体）写入本工单。文档同步：README/overview 中"桌面端 = 内嵌 HTTP 服务"的描述改为 axhub:// 协议（保留 CLI 模式说明）。版本号 bump（package.json 单源）+ CHANGELOG 未发布段记录；**不自动发版，发版前询问用户**。

**Blocked by:** 03.

**Status:** ready-for-agent

- [x] `npm test` 全绿（原有 26 项 + serve-core 新增项）
- [x] viewer 构建通过，工作台 UI 无回归
- [x] README/overview 与实际架构一致
- [x] package.json 版本 + CHANGELOG 未发布段更新，未执行任何发布动作

## Comments

## Result

npm test 34/34；viewer 构建通过；CLI 冒烟（viewer/tree/真实页面 566KB）通过；真机冒烟截图确认侧栏+iframe 渲染；README/overview 已同步；版本 bump 1.0.20 + CHANGELOG 未发布段；未执行任何发布动作。
