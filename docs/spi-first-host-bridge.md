# SPI-First 试点报告 · #1 工作区宿主（WorkspaceHost）

- 日期：2026-09-29
- 试点来源：`docs/spi-first-audit.md` 候选 #1（P0）
- 附加：顺带修候选 #2 的 AP-04（`BackupModal.vue` 直调 `localStorage`）
- 版本：desktop `1.1.4 → 1.1.5`

---

## 1. 为什么选它

三动因判定：「未来要替换 / 多实现并存 / 第三方扩展」——**多实现并存已是事实**，不是假设。
Electron 壳 ⊕ 本地 HTTP 服务 ⊕ 纯浏览器三种运行形态同时存在，原实现把三路分支用
`window.axhub?.xxx` 可选链散在 5 个业务文件的 24 处，能力缺失时**静默降级**（拿到
`undefined` 后行为未定义）。这是典型「抽象有洞 = 没抽」。

---

## 2. 语义接口（Step 1）

业务层只认 `host/index.js`，能力名全部为领域动词，**接口声明区零技术名词**
（由 conformance 用例 `接口纯净性` 强制）。

| 旧（泄漏实现） | 新（纯语义） | 类别 |
|---|---|---|
| `window.axhub.selectDir()` | `host.chooseWorkspace()` | 查询 |
| `window.axhub.getTree()` | `host.readPageManifest()` | 查询 |
| `window.axhub.pickApiFiles()` | `host.chooseDocuments()` | 查询 |
| `window.axhub.readApiFiles(p)` | `host.readDocuments(paths)` | 查询 |
| `window.axhub.version()` | `host.appVersion()` | 查询 |
| `window.axhub.checkUpdate()` | `host.lookForUpdate()` | 查询 |
| `window.axhub.clearDir()` | `host.releaseWorkspace()` | 命令 |
| `window.axhub.saveUserData(d)` | `host.archiveSnapshot(snap)` | 命令 |
| `window.axhub.clearUserData()` | `host.discardSnapshot()` | 命令 |
| `window.axhub.installUpdate()` | `host.applyUpdate()` | 命令 |
| `window.axhub.setSilentUpdate(b)` | `host.setBackgroundDownload(on)` | 命令 |
| `window.axhub.applyCloseAction(a,r)` | `host.answerExitRequest(a,r)` | 命令 |
| `window.axhub.saveCloseAction(a)` | `host.setPreferredExitAction(a)` | 命令 |
| `window.axhub.onUpdateProgress(cb)` | `host.onDownloadProgress(cb)` | 订阅 |
| `window.axhub.onUpdateAvailable(cb)` | `host.onUpdateFound(cb)` | 订阅 |
| `window.axhub.onUpdateReady(cb)` | `host.onUpdateStaged(cb)` | 订阅 |
| `window.axhub.onCloseActionRequest(cb)` | `host.onExitRequest(cb)` | 订阅 |

**三条调用契约**（由 `makeHost` 统一强制，不靠各后端自觉）：

1. 查询型（有返回值）→ 一律 Promise；不支持 **必须 reject** `UnsupportedCapability`；
   返回值 **不得为 undefined**（undefined = 静默失败）。
2. 命令型（fire-and-forget）→ 一律 Promise；不支持 → 静默 no-op。
3. 订阅型 → 一律返回 unsubscribe 且幂等；不支持 → 返回 noop。

---

## 3. 后端（Step 2）

| 后端 | 文件 | 性质 | 能力 |
|---|---|---|---|
| `electron` | `viewer/src/host/electron.js` | 真实（壳桥以参数注入，可测） | 全量 17 |
| `browser` | `viewer/src/host/browser.js` | 真实（本地服务 / 纯浏览器） | 2（读清单、选目录+前端扫描） |
| `headless` | `viewer/src/host/headless.js` | 内存（测试与降级，**SPI 成立的必要条件**） | 全量 17 |

`electron.js` 的能力集按「壳桥实际提供了什么」动态收窄，壳未升级时缺失能力走契约降级，
而不是让业务层拿到 `undefined` 踩空。

---

## 4. conformance（Step 3）

`desktop/test/host-conformance.test.js` —— 同一套用例跑遍 electron / browser / headless。

| # | 用例 | 断言要点 |
|---|---|---|
| 1 | 三后端同套契约 | 能力登记合法、返回类型、形状、命令 no-op、订阅幂等、取消返回 null、归档→丢弃时序 |
| 2 | browser 按能力降级 | 无服务能力时 `readPageManifest`/`chooseWorkspace` 必须 reject 而非发网络请求；带目录句柄时前端扫描结果与框架页排除规则 |
| 3 | **负向**：坏后端 | 声称支持 `lookForUpdate` 却返回 `undefined` → 必须被判死（证明套件有牙齿） |
| 4 | **负向**：自造能力名 | 未经 `ALL_CAPABILITIES` 登记的能力名 → 必须被拒 |
| 5 | 接口纯净性 | 接口声明区不得出现 Electron/IPC/preload/localStorage/fetch 等技术名词 |
| 6 | 守界：无 `window.axhub` | 业务层（除 `host/` 适配器目录）零残留 |
| 7 | 守界反向验证 | 扫描器确实能在 `host/` 内找到实现名（排除第 6 条是假阳性） |
| 8 | 守界：无 `localStorage` | 持久层之外零直调（含 `BackupModal`） |

**执行结果**：`node --test` 全量 **71 通过 / 0 失败**（试点前 63，新增 8）。
`npm run build:viewer` 构建通过（3222 modules）。

---

## 5. 诚实边界（Step 5，禁止省略）

### 5.1 性能边界

| 项 | 实测值 | measured |
|---|---|---|
| 查询型接口间接层开销 | **26.3 ns/次**（裸调用 43.2 ns → 经接口 69.5 ns，N=500 000，Node 22.22.2） | `true` |
| `host.supports()`（唯一进入热路径的接口调用） | **7.73 ns/次**（N=2 000 000） | `true` |
| 归档 `archiveSnapshot` 单次开销 | **未实测**（`measured: false`）—— 300ms 防抖触发，非热路径 | `false` |

**热路径说明**：切标签 / 搜索 / 侧栏渲染等高频操作**不经过**宿主方法调用，只走一次
`host.supports()`（7.73 ns）；`archiveSnapshot` 由 300ms 防抖合并。因此间接层开销对
可感知性能无影响——但这是**按当前调用频率得出的结论**，若未来把宿主查询放进渲染循环，
需重新实测。

### 5.2 能力边界

后端能力不齐时**禁止静默失败**，走 `capabilities` 声明 + 两条降级路径：

| 能力缺失 | 降级行为 |
|---|---|
| `readPageManifest` | 页面显示「当前宿主无法读取页面清单」，`serverOk=false` |
| `chooseWorkspace` | 提示「请用桌面端（npm start）或在 https/localhost 下访问」 |
| `chooseDocuments` / `readDocuments` | 提示「当前环境不支持选择文件」，导入退化为拖拽/本地选择 |
| `lookForUpdate` / `applyUpdate` | 提示「当前环境不支持在线更新」 |
| `archiveSnapshot` / `discardSnapshot` | 静默跳过（数据只留同源缓存，重启可能丢——与改造前纯浏览器行为一致） |
| `releaseWorkspace` | 退回 `location.reload()` |

**已知不对称**：`chooseWorkspace()` 返回 `{ name, pages }`，其中 `pages` 在 electron 后端
恒为 `null`（壳侧选完会整页 reload，清单由 reload 后的 `readPageManifest` 重新供给），
在 browser 后端为实际扫描结果。这是两种宿主的**真实差异**，接口不掩盖它，调用方
（`store.js selectDirectory`）按 `pages` 是否为 null 分流——此差异已写入代码注释。

### 5.3 适用边界（防止后人过度设计）

- **不值得**为 UI 组件库（ant-design-vue，16 文件）做 SPI：无替换计划、无三方扩展，
  抽象成本 >> 收益（审计已列为「劝阻」）。
- **不值得**为 `parseMarkdown` 做 SPI：单实现且已有测试，属内部模块边界。
- 若后端数涨到 **6+** 且能力差异大（例如新增移动端壳 / WebView 嵌入 / CLI），
  应**拆分成多个 SPI**（如「工作区」与「应用生命周期」分开），而不是继续往
  `WorkspaceHost` 里加分支。
- 新增宿主能力**必须**先在 `ALL_CAPABILITIES` 登记，再实现后端，最后补 conformance
  用例；顺序颠倒会被用例 4 判死。

---

## 6. 改动文件清单

**新建**
- `desktop/viewer/src/host/index.js`（语义接口 + `makeHost` 契约强制 + 工厂）
- `desktop/viewer/src/host/electron.js`
- `desktop/viewer/src/host/browser.js`
- `desktop/viewer/src/host/headless.js`
- `desktop/test/host-conformance.test.js`
- `docs/spi-first-audit.md`、`docs/spi-first-host-bridge.md`（本文件）

**修改**
- `viewer/src/store.js` — `fetchTree` / `selectDirectory` 改走 `host`；删除内联的
  `scanDirHandle` 与 `AxHubScan` import（扫描逻辑迁入 browser 后端）
- `viewer/src/user-data.js` — 归档/清快照改走 `host`；新增 `readSnapshot(fullKey)` 出口
- `viewer/src/App.vue` — 关闭询问、更新进度/就绪/安装 改走 `host`
- `viewer/src/components/modals/SettingsModal.vue` — 版本、检查更新、文档选择、解绑目录、
  关闭行为、静默下载 改走 `host`
- `viewer/src/components/api/modals/ImportMdModal.vue` — 文档读取改走 `host`
- `viewer/src/components/modals/BackupModal.vue` — **AP-04 修复**：导出快照改走
  `userData.readSnapshot(false)`，删除直调 `localStorage` 与 `UserKeys` import
- `desktop/package.json` — version `1.1.4 → 1.1.5`

**未动（红线）**
- `main.js` / `preload.js` / `serve-core.js` / `axhub-server.js` / `scan-shared.js` /
  `user-store.js` / `user-keys.js` —— 主进程与协议层一行未改，行为零变化。

---

## 7. 反模式自检（AP-01 ~ AP-08）

| # | 反模式 | 结论 | 依据 |
|---|---|---|---|
| AP-01 | 只有 1 个实现 | ✅ | 3 个后端（electron / browser / headless），headless 非可选装饰 |
| AP-02 | 接口含技术名词 | ✅ | 用例 5 强制扫描接口声明区；命名对照表见 §2 |
| AP-03 | 无 conformance | ✅ | 8 条用例，含 2 条负向（坏后端必须被抓） |
| AP-04 | 业务绕过接口直调底层 | ✅ | 用例 6/8 扫描：`window.axhub` 与 `localStorage` 业务层零残留；用例 7 反证扫描器有效 |
| AP-05 | 只定义类型不定义行为 | ✅ | 契约含返回类型、undefined 禁令、取消返回 null、订阅幂等、归档→丢弃时序 |
| AP-06 | 为「可能换」过度设计 | ✅ | 多实现并存是**既成事实**；组件库/解析器已明确劝阻不做 |
| AP-07 | 后端爆炸（6+） | ✅ | 当前 3 个；§5.3 写明涨到 6+ 时拆分而非加分支 |
| AP-08 | 抽象成本不透明 | ✅ | §5.1 两条实测数据 + 一条明确标注 `measured: false` |

---

## 8. 剩余候选与下一步

| # | 耦合点 | 建议 |
|---|---|---|
| 2 | 用户数据持久（localStorage ⊕ 磁盘） | AP-04 已修；**是否提升为独立 SPI `UserDataStore` 待定**——当前双实现已被 `user-data.js` 收口且无 conformance，若要补，下一轮做（含快照格式契约测试） |
| 3 | 页面清单数据源 | 已随 #1 一并收敛（三分支进 browser/electron 后端）；**无需单独再做** |
| 4 | toast 通知 `message.*`（16 文件 61 处） | 保持 P2 观察：无替换计划，抽象属过度设计；仅记录「逻辑层 `store.js` 6 处直接依赖 UI 库」这一事实 |
| 5 | UI 组件库 | 明确不做 |
| 6 | Markdown 解析 | 内部模块边界，不做 |
| 7 | 扫描/静态服务 | 已解耦，正面样板 |

## 9. 未做的事与风险

- `archiveSnapshot` 的端到端落盘（渲染层 → 主进程 → 磁盘）**未做集成测试**，
  当前只覆盖「后端把快照交出去」这一层；主进程 `user-store.js` 侧仍是既有单测覆盖。
- `headless` 后端目前**只被测试使用**，尚未接入任何生产降级路径（离屏渲染/SSR 本工作台
  暂无此类场景）；它的首要价值是可替换性的验证器。
- 性能数据在本机 Node 22.22.2 单次采样，未做多轮取中位数；若需对外承诺数字请重测。
