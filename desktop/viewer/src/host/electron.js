import { makeHost, ALL_CAPABILITIES } from './index.js'

/* ==========================================================================
 * 桌面壳后端（electron）
 * --------------------------------------------------------------------------
 * 逻辑自 preload 桥原样搬入，行为零变化；桥本身以参数注入（不直接摸全局），
 * 使本后端可在 node:test 下用假桥跑 conformance。
 * 能力最全：清单走壳内 IPC，清单/文档/更新/退出/归档全部可用。
 * ========================================================================== */

export function createElectronHost (bridge) {
  const b = bridge || (typeof window !== 'undefined' ? window.axhub : null)
  const can = (name) => !!b && typeof b[name] === 'function'
  const call = (name, ...args) => (can(name) ? b[name](...args) : undefined)

  const impl = {
    id: 'electron',
    // 能力声明按「桥实际提供了什么」动态收窄：壳未升级时缺失能力会走契约降级，
    // 而不是让业务层拿到 undefined 后自己踩空。
    capabilities: ALL_CAPABILITIES.filter((name) => {
      const map = {
        chooseWorkspace: 'selectDir',
        releaseWorkspace: 'clearDir',
        readPageManifest: 'getTree',
        chooseDocuments: 'pickApiFiles',
        readDocuments: 'readApiFiles',
        appVersion: 'version',
        lookForUpdate: 'checkUpdate',
        applyUpdate: 'installUpdate',
        setBackgroundDownload: 'setSilentUpdate',
        archiveSnapshot: 'saveUserData',
        discardSnapshot: 'clearUserData',
        onDownloadProgress: 'onUpdateProgress',
        onUpdateFound: 'onUpdateAvailable',
        onUpdateStaged: 'onUpdateReady',
        onExitRequest: 'onCloseActionRequest',
        answerExitRequest: 'applyCloseAction',
        setPreferredExitAction: 'saveCloseAction'
      }
      return can(map[name])
    }),

    async chooseWorkspace () {
      const p = await call('selectDir')
      // 壳侧选完会整页 reload，清单由 reload 后的 readPageManifest 重新供给 → pages 为 null
      if (!p) return null
      return { name: p, pages: null }
    },
    async releaseWorkspace () { await call('clearDir') },
    async readPageManifest () { return await call('getTree') },
    async chooseDocuments () { return (await call('pickApiFiles')) || [] },
    async readDocuments (paths) { return (await call('readApiFiles', paths)) || [] },
    async appVersion () { return await call('version') },
    async lookForUpdate () { return await call('checkUpdate') },
    async archiveSnapshot (snapshot) { await call('saveUserData', snapshot) },
    async discardSnapshot () { await call('clearUserData') },

    applyUpdate () { call('installUpdate') },
    setBackgroundDownload (on) { call('setSilentUpdate', !!on) },
    answerExitRequest (action, remember) { call('applyCloseAction', action, remember) },
    setPreferredExitAction (action) { call('saveCloseAction', action || '') },

    onDownloadProgress (cb) { call('onUpdateProgress', cb); return () => {} },
    onUpdateFound (cb) { call('onUpdateAvailable', cb); return () => {} },
    onUpdateStaged (cb) { call('onUpdateReady', cb); return () => {} },
    onExitRequest (cb) { call('onCloseActionRequest', cb); return () => {} }
  }

  return makeHost('electron', impl)
}
