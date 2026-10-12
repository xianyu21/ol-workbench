import { makeHost, ALL_CAPABILITIES } from './index.js'

/* ==========================================================================
 * 内存后端（headless）
 * --------------------------------------------------------------------------
 * 用途：① conformance 契约测试的可控后端；② 无任何宿主能力环境（如被嵌入的
 * 离屏渲染、SSR 预渲染）的降级后端，保证业务层调用永不因宿主缺失而崩。
 * 全部数据由调用方注入（options），本后端自身不含任何业务默认值语义。
 *
 * 单后端 SPI = 假 SPI（可替换性从未被验证），因此本后端是 SPI 成立的必要条件，
 * 不是可选装饰：删掉它，宿主演化就退化成不可验证的假设。
 * ========================================================================== */

export function createHeadlessHost (options) {
  const o = options || {}
  const trace = o.trace || null           // 调用轨迹（测试注入）：[{ name, args }]
  const store = o.store || new Map()      // 归档快照存放处（测试注入）
  const subs = {}                          // 订阅者表
  const keep = (name, args) => { if (trace) trace.push({ name, args }) }

  const emit = (name, payload) => { (subs[name] || []).forEach(cb => cb(payload)) }

  const impl = {
    id: 'headless',
    capabilities: ALL_CAPABILITIES.slice(),

    async chooseWorkspace () {
      keep('chooseWorkspace', [])
      if (o.pickCancelled) return null
      return { name: o.workspaceName || 'headless-workspace', pages: o.pages || [] }
    },
    async releaseWorkspace () { keep('releaseWorkspace', []) },
    async readPageManifest () { keep('readPageManifest', []); return o.manifest || { name: '', root: '', hasData: false, pages: [] } },
    async chooseDocuments () { keep('chooseDocuments', []); return (o.documentPaths || []).slice() },
    async readDocuments (paths) {
      keep('readDocuments', [paths])
      const byPath = o.documents || {}
      return (paths || []).map(p => byPath[p]).filter(Boolean)
    },
    async appVersion () { keep('appVersion', []); return o.version || '0.0.0' },
    async lookForUpdate () { keep('lookForUpdate', []); return o.update || null },
    async updateStatus () {
      keep('updateStatus', [])
      return o.updateStatus || { version: o.version || '0.0.0', channel: 'stable', lastKnownGood: o.version || '0.0.0', portable: false }
    },
    async archiveSnapshot (snapshot) { keep('archiveSnapshot', [snapshot]); store.set('snapshot', snapshot) },
    async discardSnapshot () { keep('discardSnapshot', []); store.delete('snapshot') },

    applyUpdate () { keep('applyUpdate', []) },
    setBackgroundDownload (on) { keep('setBackgroundDownload', [on]) },
    answerExitRequest (action, remember) { keep('answerExitRequest', [action, remember]) },
    setPreferredExitAction (action) { keep('setPreferredExitAction', [action]) },
    setUpdateChannel (channel) { keep('setUpdateChannel', [channel]) },
    requestUpdateRollback () { keep('requestUpdateRollback', []) },
    reportFirstLaunchReady () { keep('reportFirstLaunchReady', []) },
    retryDownloadNow () { keep('retryDownloadNow', []) },

    onDownloadProgress (cb) { return subscribe('onDownloadProgress', cb) },
    onUpdateFound (cb) { return subscribe('onUpdateFound', cb) },
    onUpdateStaged (cb) { return subscribe('onUpdateStaged', cb) },
    onExitRequest (cb) { return subscribe('onExitRequest', cb) },
    onUpdateEvent (cb) { return subscribe('onUpdateEvent', cb) }
  }

  function subscribe (name, cb) {
    if (typeof cb !== 'function') return () => {}
    if (!subs[name]) subs[name] = []
    subs[name].push(cb)
    let off = false
    return () => {
      if (off) return
      off = true
      subs[name] = subs[name].filter(x => x !== cb)
    }
  }

  // 测试用发射口：不进业务契约，仅 headless 后端拥有（业务层不得依赖）
  return Object.freeze(Object.assign({}, makeHost('headless', impl), { emit }))
}
