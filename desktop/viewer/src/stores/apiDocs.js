import { reactive, computed } from 'vue'
import { defineStore } from 'pinia'
import { message } from 'ant-design-vue'
import * as userData from '@/lib/user-data.js'
import * as apiLib from '@/lib/api-docs.js'
import { parseMarkdown } from '@/lib/api-docs-md.js'

/* ==========================================================================
 * API 视图 store：业务模块库（导入的 Markdown 接口文档）
 * 单独 persistApi()，不并入 persist()——后者每次切标签都调用，会反复序列化大段 md。
 * 解析结果按 moduleId:rev 记忆化；只存原始 md，解析规则升级后无需迁移数据。
 * ========================================================================== */

export const useApiStore = defineStore('apiDocs', () => {
  const api = reactive({
    docs: userData.get('apiDocs', { seq: 1, modules: [] }),
    files: userData.get('apiFiles', []), // 登记的接口文档文件（路径字符串数组）
    q: '',
    methods: [],
    closed: {},          // 业务模块折叠态 { [modId]: bool }（运行时）
    closedGroups: {},    // 分组折叠态 { [modId + '\u0000' + title]: bool }（运行时）
    sel: { moduleId: null, epId: null }
  })

  function persistApi () {
    const ok = userData.set('apiDocs', api.docs)
    userData.set('apiFiles', api.files)
    if (!ok) { message.error('本地存储空间不足，接口模块可能未保存'); return false }
    userData.persist()
    return true
  }

  /* ---------- 解析与派生结构 ---------- */
  const parseCache = new Map()
  function clearCache (id) {
    if (!id) { parseCache.clear(); return }
    for (const k of Array.from(parseCache.keys())) {
      if (String(k).indexOf(id + ':') === 0) parseCache.delete(k)
    }
  }

  /* 模块 + 解析结果（解析后 endpoint 的 id 前缀模块 id，保证全库唯一） */
  const apiModules = computed(() => {
    const list = (api.docs && api.docs.modules) || []
    return list.map(m => {
      const key = m.id + ':' + (m.rev || 1)
      let doc = parseCache.get(key)
      if (!doc) {
        doc = parseMarkdown(m.md, { name: m.name, source: (m.src && m.src !== 'auto') ? m.src : undefined })
        if (parseCache.size > 64) parseCache.clear()
        parseCache.set(key, doc)
      }
      const endpoints = doc.endpoints.map((ep, i) =>
        Object.assign({}, ep, { id: m.id + ':' + (ep.id || i), moduleId: m.id }))
      return { mod: m, doc, endpoints }
    })
  })

  /* 侧栏树：搜索 + 方法筛选后的 模块 → 分组 → 接口（三级，分组可折叠） */
  const apiTree = computed(() => {
    const kw = String(api.q || '').trim().toLowerCase()
    const methods = api.methods || []
    const matchEp = (ep) => {
      if (methods.length && methods.indexOf(ep.method) < 0) return false
      if (!kw) return true
      const hay = (ep.name + ' ' + ep.path + ' ' + ep.method + ' ' + (ep.summary || '') + ' ' + (ep.desc || '')).toLowerCase()
      return kw.split(/\s+/).every(w => hay.indexOf(w) >= 0)
    }
    return apiModules.value.map(m => {
      const byGroup = {}
      const order = []
      m.endpoints.forEach(ep => {
        const g = ep.group || ''
        if (!byGroup[g]) { byGroup[g] = []; order.push(g) }
        byGroup[g].push(ep)
      })
      const groups = order.map(g => ({ title: g, endpoints: byGroup[g].filter(matchEp) }))
        .filter(g => !kw || g.endpoints.length) // 搜索时隐藏空分组
      const modHit = !kw || String(m.mod.name).toLowerCase().indexOf(kw) >= 0
      const matchCount = groups.reduce((s, g) => s + g.endpoints.length, 0)
      return { mod: m.mod, doc: m.doc, groups, total: m.endpoints.length, matchCount, modHit }
    }).filter(x => x.modHit || x.matchCount)
  })

  const apiActiveModule = computed(() => {
    const id = api.sel && api.sel.moduleId
    if (!id) return null
    return apiModules.value.filter(m => m.mod.id === id)[0] || null
  })

  const apiActiveEp = computed(() => {
    const sel = api.sel
    if (!sel || !sel.epId) return null
    for (const m of apiModules.value) {
      const ep = m.endpoints.filter(e => e.id === sel.epId)[0]
      if (ep) return ep
    }
    return null
  })

  /* ---------- 选择 / 折叠 ---------- */
  function apiSelect (moduleId, epId) { api.sel = { moduleId, epId } }
  function apiToggleModule (id) { api.closed[id] = !api.closed[id] }
  /* 分组折叠：key 用 ### 分隔模块与分组名（分组标题不会含该串） */
  function apiToggleGroup (modId, title) {
    const key = modId + '###' + title
    api.closedGroups[key] = !api.closedGroups[key]
  }
  function apiSetGroups (modId, titles, closed) {
    titles.forEach(t => { api.closedGroups[modId + '###' + t] = closed })
  }

  /* ---------- 文档文件（可多个，供「从文件导入」） ---------- */
  function apiAddFiles (paths) {
    const add = (paths || []).filter(p => p && api.files.indexOf(p) < 0)
    if (!add.length) return 0
    api.files.push(...add)
    persistApi()
    return add.length
  }
  function apiRemoveFile (p) {
    const i = api.files.indexOf(p)
    if (i >= 0) { api.files.splice(i, 1); persistApi() }
  }

  /* ---------- 模块 CRUD ---------- */
  function apiAddModule (name) {
    const r = apiLib.addModule(api.docs, { name: name || '未命名模块', md: '', importedAt: Date.now() })
    api.docs = r.docs
    persistApi()
    return r.id
  }
  /* files: [{ name, size, text }] —— 每个文件一个业务模块 */
  function apiImportFiles (files) {
    const r = apiLib.bulkAddFromFiles(api.docs, files, Date.now())
    api.docs = r.docs
    persistApi()
    return r.ids
  }
  function apiRenameModule (id, name) {
    api.docs = apiLib.renameModule(api.docs, id, name)
    persistApi()
  }
  function apiRemoveModule (id) {
    api.docs = apiLib.removeModule(api.docs, id)
    clearCache(id)
    if (api.sel && api.sel.moduleId === id) api.sel = { moduleId: null, epId: null }
    delete api.closed[id]
    persistApi()
  }
  /* 重新导入覆盖：保留 id 与用户自定义名称 */
  function apiReplaceMd (id, md, fileName, size) {
    api.docs = apiLib.replaceModuleMd(api.docs, id, md, fileName, size, Date.now())
    clearCache(id)
    persistApi()
  }

  return {
    api, persistApi,
    apiModules, apiTree, apiActiveModule, apiActiveEp,
    apiSelect, apiToggleModule, apiToggleGroup, apiSetGroups,
    apiAddFiles, apiRemoveFile,
    apiAddModule, apiImportFiles, apiRenameModule, apiRemoveModule, apiReplaceMd
  }
})
