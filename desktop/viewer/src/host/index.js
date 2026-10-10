/* ==========================================================================
 * 工作区宿主（WorkspaceHost）—— 语义接口 + 后端注册
 * --------------------------------------------------------------------------
 * 本文件是业务层唯一允许 import 的宿主出入口。业务层对「桌面壳 / 测试」两类
 * 运行环境零知识：只认下面这份能力清单与调用契约。
 *
 * 命名纪律：接口内禁止出现任何厂商/技术名词（Electron / IPC / preload /
 * localStorage / fetch / FileSystemAccess 一律不得出现）。全部用领域动词。
 *
 * ── 调用契约（由 makeHost 统一强制，不靠各后端自觉）────────────────────
 * 1. 查询型能力（有返回值）：一律返回 Promise。
 *    未登记/未实现 → Promise.reject(UnsupportedCapability)。禁止静默返回 undefined。
 * 2. 命令型（fire-and-forget，无返回值）：一律返回 Promise。
 *    未登记/未实现 → 静默 resolve（等同「无宿主可发」）。
 * 3. 订阅型：一律返回 unsubscribe 函数；未登记 → 返回 noop。
 * 4. host.capabilities 冻结数组 + host.supports(name) 供业务层做优雅降级提示。
 *
 * ── 后端（A 阶段已裁剪 browser 后端，仅保留两后端）─────────────────────
 * electron.js  桌面壳后端（真实，能力最全）
 * headless.js  内存后端（测试与降级用；单后端 SPI = 假 SPI，此后端必须有）
 * 无壳无浏览器选择能力时（如被嵌入/SSR 预渲染），createHost() 兜底降级到 headless 内存后端，
 * 而非报错——保证业务层调用永不因宿主缺失而崩。
 * 契约由 test/host-conformance.test.js 用同一套用例跑遍两后端 + 1 个坏后端。
 * ========================================================================== */
import { createElectronHost } from './electron.js'
import { createHeadlessHost } from './headless.js'

/* 宿主不支持某能力时抛出。业务层应先用 supports() 判断做提示，而不是吞掉此错误。 */
export class UnsupportedCapability extends Error {
  constructor (capability) {
    super('当前宿主不支持该能力：' + capability)
    this.name = 'UnsupportedCapability'
    this.code = 'UNSUPPORTED_CAPABILITY'
    this.capability = capability
  }
}

/* 查询型：必须有返回值。不支持 → reject；返回值不得为 undefined（undefined = 静默失败）。 */
export const QUERIES = [
  'chooseWorkspace',   // () => { name, pages: Page[]|null } | null（用户取消 → null）
  'readPageManifest',  // () => { name, root, hasData, pages: Page[], error? }
  'chooseDocuments',   // () => string[]：选择接口文档文件（多选），用户取消 → []
  'readDocuments',     // (paths) => [{ name, path, size, text, error? }]
  'appVersion',        // () => string
  'lookForUpdate'      // () => { ok, available?, version?, error? } | null
]

/* 命令型：无返回值，fire-and-forget。不支持 → 静默 no-op（等同「无宿主可发」）。 */
export const COMMANDS = [
  'releaseWorkspace',       // () 解绑当前目录
  'archiveSnapshot',        // (snapshot) 持久层整包归档
  'discardSnapshot',        // () 清空宿主归档快照
  'applyUpdate',            // () 立即安装已就绪的更新
  'setBackgroundDownload',  // (on) 后台静默下载开关
  'answerExitRequest',      // (action, remember) 回应宿主发起的退出询问
  'setPreferredExitAction'  // (action) 记住默认退出行为
]

/* 订阅型：返回 unsubscribe */
export const SUBSCRIPTIONS = [
  'onDownloadProgress', // cb(pct|null)
  'onUpdateFound',      // cb({ version })
  'onUpdateStaged',     // cb({ version })
  'onExitRequest'       // cb()：宿主请求确认退出
]

export const ALL_CAPABILITIES = QUERIES.concat(COMMANDS, SUBSCRIPTIONS)

const NOOP = () => {}

/* 把裸实现包装成守约宿主：三条契约在这里一次性强制，后端只管实现。 */
export function makeHost (id, impl) {
  const caps = Object.freeze((impl.capabilities || []).slice())
  const has = new Set(caps)
  const resolve = (name) => (has.has(name) && typeof impl[name] === 'function') ? impl[name] : null

  const host = { id, capabilities: caps, supports: (name) => has.has(name) }

  QUERIES.forEach(name => {
    host[name] = (...args) => {
      const fn = resolve(name)
      if (!fn) return Promise.reject(new UnsupportedCapability(name))
      try { return Promise.resolve(fn.apply(impl, args)) } catch (e) { return Promise.reject(e) }
    }
  })
  COMMANDS.forEach(name => {
    host[name] = (...args) => {
      const fn = resolve(name)
      if (!fn) return Promise.resolve()
      try { return Promise.resolve(fn.apply(impl, args)) } catch (e) { return Promise.resolve() }
    }
  })
  SUBSCRIPTIONS.forEach(name => {
    host[name] = (cb) => {
      const fn = resolve(name)
      if (!fn) return NOOP
      try { const off = fn.call(impl, cb); return typeof off === 'function' ? off : NOOP } catch (e) { return NOOP }
    }
  })

  return Object.freeze(host)
}

/* 工厂：业务层/测试显式指定后端；不指定则按环境自动探测。 */
export function createHost (mode) {
  if (mode === 'electron' || mode === 'headless') {
    return { electron: createElectronHost, headless: createHeadlessHost }[mode]()
  }
  if (mode) throw new Error('未知宿主后端：' + mode)
  const w = typeof window !== 'undefined' ? window : null
  // 桌面壳桥存在 → 能力最全，优先
  if (w && w.axhub) return createElectronHost(w.axhub)
  // 无壳无浏览器选择能力（如被嵌入/SSR 预渲染）→ 降级到内存后端，而非报错
  return createHeadlessHost()
}

/* 应用运行期单例。测试不要用它，直接用 createHost('headless') 显式构造。 */
export const host = createHost()
