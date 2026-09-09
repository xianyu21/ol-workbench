import { reactive, computed } from 'vue'
import { message } from 'ant-design-vue'
import * as userData from './user-data.js'

/* ==========================================================================
 * 全局状态 store（对应旧版 axhub-viewer.html 的 S 对象）
 * 持久化全部经 user-data.js（key 清单单源 user-keys.js）；store 是响应式 adapter，
 * 组件改状态后调用 persist() 把已知 key 整体写穿缓存并触发防抖落盘。
 * ========================================================================== */

function load (k, d) { return userData.get(k, d) }
function saveRaw (k, v) { userData.set(k, v) }

export const PALETTE = ['#1296db', '#16a34a', '#f97316', '#e5484d', '#8b5cf6', '#0891b2', '#db2777', '#65a30d', '#6366f1', '#ca8a04']
export const DEF_TAGS = [
  { name: '高频', color: '#1296db' }, { name: '待评审', color: '#f97316' },
  { name: '已确认', color: '#16a34a' }, { name: '问题', color: '#e5484d' }
]
export const NATIVE_ID = 'native-index'
export const NATIVE_PAGE = { id: NATIVE_ID, name: 'AxHub 原生导航', path: 'index.html', native: true, group: '' }

export const store = reactive({
  serverOk: false,
  rootName: '',
  rootDir: '',           // 当前加载的 AxHub 导出目录完整路径（设置面板展示用）
  hasData: false,
  loadError: '',
  loaded: false,          // fetchTree 完成过一次
  projects: load('projects', []),
  tags: load('tags', DEF_TAGS),
  tabs: load('tabs', []),        // [{id,pid,pinned,title,native,sleep,loading}]
  active: load('active', null),
  settings: Object.assign(
    { view: 'list', maxAlive: 8, group: true, collapsed: false, closeAction: '' },
    load('settings', {})
  ),
  q: '',
  filterTags: [],
  secClosed: load('secClosed', {}),
  recent: load('recent', []),
})

export const tabSeq = { n: load('tabSeq', 1) }

export function persist () {
  saveRaw('projects', store.projects)
  saveRaw('tags', store.tags)
  saveRaw('tabs', store.tabs)
  saveRaw('active', store.active)
  saveRaw('settings', store.settings)
  userData.persist() // set 已各自触发，这里兜底立即合并一次防抖
}
/* ---------- 工具 ---------- */
export function fmtSize (b) {
  if (!b) return ''
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB'
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'
  return (b / 1073741824).toFixed(2) + ' GB'
}
export function pad (n) { return n < 10 ? '0' + n : '' + n }

export function tagColor (name) {
  const t = store.tags.filter(x => x.name === name)[0]
  if (t) return t.color
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
export function ensureTag (name) {
  if (!name) return
  if (!store.tags.some(t => t.name === name)) store.tags.push({ name, color: tagColor(name) })
}
export function hueOf (str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
export function initials (name) {
  const s = String(name)
  const m = s.match(/[一-龥]/)
  if (m) return m[0]
  return s.slice(0, 2).toUpperCase() || '?'
}

/* ---------- 标签页生命周期：纯函数在 tabs.js，store 只做响应式 adapter ----------
 * tabs.js 零 import、不可变返回新状态；这里把返回值赋回 reactive store 并持久化。
 * invariant「激活标签永不休眠」由 tabs.js 构造保证（旧版靠 ViewerPane 安全网 watcher）。 */
import * as tabLifecycle from './tabs.js'
import * as library from './library.js'

// 页面 URL 词汇由 tabs.js 单源（自导航/链接拦截与 store 共用）
export const enc = tabLifecycle.enc
export const srcOf = tabLifecycle.srcOf

export function getP (id) {
  if (id === NATIVE_ID) return NATIVE_PAGE
  return store.projects.filter(p => p.id === id)[0]
}
export function tabOf (pid) { return store.tabs.filter(t => t.pid === pid)[0] }
export const activeTab = computed(() => store.tabs.filter(t => t.id === store.active)[0] || null)

/* ---------- 数据加载 ---------- */
export async function fetchTree () {
  store.loaded = true
  try {
    // 桌面端：axhub:// 协议下无 /_api/tree，页面清单走 preload IPC；
    // CLI 浏览器模式（http 服务）无 axhub 桥，回退 fetch 同源接口
    let data
    if (window.axhub && typeof window.axhub.getTree === 'function') {
      data = await window.axhub.getTree()
    } else {
      const r = await fetch('/_api/tree')
      data = await r.json()
    }
    store.serverOk = true
    if (data.error) { store.loadError = data.error; return }
    mergeTree(data)
    store.rootName = data.name
    store.rootDir = data.root || ''
    store.hasData = !!data.hasData
    store.loadError = ''
  } catch (e) {
    store.serverOk = false
    store.loadError = '无法读取页面清单'
  }
}
function mergeTree (data) {
  // 清单重建 + 本地标注按路径保留：纯函数在 library.js
  store.projects = library.mergeScannedPages(store.projects || [], data.pages, Date.now()).projects
  // 清理已不存在页面的标签页引用（原生导航标签不来自 projects，保留）
  const pruned = tabLifecycle.pruneTabs(tabModel(), pid => pid === NATIVE_ID || store.projects.some(p => p.id === pid))
  if (pruned) { store.tabs = pruned.tabs; store.active = pruned.active }
  persist()
}

/* ---------- 多标签（生命周期决策在 tabs.js，此处只赋回 + 持久化） ---------- */
function tabModel () { return { tabs: store.tabs, active: store.active, tabSeq } }
function applyTabs (r) {
  if (!r) return
  if (r.tabs !== undefined) store.tabs = r.tabs
  if (r.active !== undefined) store.active = r.active
  if (r.tabSeq && r.tabSeq !== tabSeq) tabSeq.n = r.tabSeq.n
  persist()
}

export function bump (p) {
  if (!p || p.native) return
  p.openCount = (p.openCount || 0) + 1
  p.lastOpen = Date.now()
  const r = load('recent', []).filter(x => x !== p.id)
  r.unshift(p.id)
  store.recent = r.slice(0, 12)
  saveRaw('recent', store.recent)
}

// forceNew=true 强制新标签；否则复用未固定的当前标签（浏览器式替换）
export function openProject (pid, forceNew) {
  const p = getP(pid)
  if (!p) return null
  applyTabs(tabLifecycle.open(tabModel(), { id: p.id, name: p.name, native: p.native }, { forceNew, now: Date.now() }))
  bump(p)
  return tabOf(pid)
}

export function setActive (id) {
  if (store.active === id) return
  applyTabs(tabLifecycle.setActive(tabModel(), id, Date.now()))
}
export function wakeTab (id) { applyTabs(tabLifecycle.wake(tabModel(), id, Date.now())) }
export function closeTab (id) { applyTabs(tabLifecycle.close(tabModel(), id)) }
export function togglePin (id) { applyTabs(tabLifecycle.togglePin(tabModel(), id)) }
export function reloadTab (id) { applyTabs(tabLifecycle.reload(tabModel(), id)) }
export function markLoaded (id) { applyTabs(tabLifecycle.markLoaded(tabModel(), id)) }
export function sweepLru () { applyTabs(tabLifecycle.lruSweep(tabModel(), store.settings.maxAlive)) }
export function restoreSessionTabs () { applyTabs(tabLifecycle.restoreSession(tabModel())) }
export function retargetTab (id, page) {
  applyTabs(tabLifecycle.retargetSelfNav(tabModel(), id, page))
  bump(page)
}
export function closeOthers (keep) { applyTabs(tabLifecycle.closeOthers(tabModel(), keep)) }
export function closeAllUnpinned () { applyTabs(tabLifecycle.closeAllUnpinned(tabModel())) }

/* ---------- 侧栏筛选/排序 ---------- */
export const visibleProjects = computed(() => {
  const q = store.q.trim().toLowerCase()
  const favOnly = store.filterTags.indexOf('__fav') >= 0
  const need = store.filterTags.filter(t => t !== '__fav')
  return store.projects.filter(p => {
    if (favOnly && !p.fav) return false
    if (need.length) {
      const tg = p.tags || []
      for (let i = 0; i < need.length; i++) if (tg.indexOf(need[i]) < 0) return false
    }
    if (!q) return true
    const hay = (p.name + ' ' + p.group + ' ' + (p.tags || []).join(' ')).toLowerCase()
    return q.split(/\s+/).every(w => hay.indexOf(w) >= 0)
  }).sort((a, b) => {
    // 排序 UI 已移除：固定收藏置顶 + 名称排序
    if ((b.fav ? 1 : 0) !== (a.fav ? 1 : 0)) return (b.fav ? 1 : 0) - (a.fav ? 1 : 0)
    return a.name.localeCompare(b.name, 'zh')
  })
})

// 侧栏渲染结构：[{key,title,icon,items:[page],children:[sec],depth}]
export const sidebarSections = computed(() => {
  const list = visibleProjects.value
  const sections = []
  if (!store.projects.length || !list.length) return sections
  // 最近访问分组：固定 5 条、常驻展开，不参与全部展开/折叠（用响应式 store.recent，打开页面即时出现）
  const recent = store.recent.map(getP).filter(p => p && list.indexOf(p) >= 0).slice(0, 5)
  if (recent.length && !store.q.trim() && !store.filterTags.length) {
    sections.push({ key: '__recent', title: '最近访问', icon: 'clock', items: recent, children: [], fixed: true })
  }
  if (store.settings.group && !store.q.trim() && !store.filterTags.length) {
    buildTree(list).forEach(s => sections.push(s))
  } else {
    sections.push({ key: '__all', title: store.q.trim() ? '搜索结果' : '全部页面', icon: 'layers', items: list, children: [] })
  }
  return sections
})

// 单层分组：按编号前缀首段（如 00-07-01 → 00）分组，组内平铺页面，不再嵌套
function parsePrefix (name) {
  const m = /^(\d+(?:-\d+)*)[_]?(.*)$/.exec(String(name || ''))
  if (!m) return null
  return { segs: m[1].split('-'), title: m[2].replace(/^_+/, '') }
}
function buildTree (list) {
  const groups = {}; const order = []
  list.forEach(p => {
    const pp = parsePrefix(String(p.name == null ? '' : p.name))
    const g = pp ? pp.segs[0] : '未分组'
    if (!groups[g]) { groups[g] = []; order.push(g) }
    groups[g].push(p)
  })
  order.sort((a, b) => a.localeCompare(b, 'zh'))
  return order.map(g => ({ key: 'g_' + g, title: g, icon: g === '未分组' ? 'layers' : 'folder', items: groups[g], children: [], depth: 0 }))
}

// 收集所有分组（含嵌套）的 key，用于全部折叠/展开（最近访问分组固定展开，不参与）
function collectSectionKeys (sections) {
  const out = []
  const walk = arr => arr.forEach(s => {
    if (!s.fixed) out.push(s.key)
    if (s.children && s.children.length) walk(s.children)
  })
  walk(sections)
  return out
}
export function toggleSection (key) {
  store.secClosed[key] = !store.secClosed[key]
  saveRaw('secClosed', store.secClosed)
}
export function collapseAll () {
  collectSectionKeys(sidebarSections.value).forEach(k => { store.secClosed[k] = true })
  saveRaw('secClosed', store.secClosed)
}
export function expandAll () {
  collectSectionKeys(sidebarSections.value).forEach(k => { store.secClosed[k] = false })
  saveRaw('secClosed', store.secClosed)
}
// 找出某个页面所在的所有分组 key（从根到其直接父级），用于激活时自动展开祖先
export function ancestorKeysOfPid (sections, pid) {
  const path = []
  const walk = (arr, chain) => {
    for (const s of arr) {
      if (s.items.some(p => p.id === pid)) { path.push(...chain, s.key); return true }
      if (s.children && walk(s.children, chain.concat(s.key))) return true
    }
    return false
  }
  walk(sections, [])
  return path
}

/* ---------- 标签页管理弹窗辅助 ---------- */
export function renameProject (id, name) {
  const p = getP(id)
  if (!p || !name || !name.trim()) return
  p.name = name.trim(); p.renamed = 1
  applyTabs(tabLifecycle.renameSync(tabModel(), id, p.name))
}

/* ---------- 选择目录（页面内设置 / 顶栏触发） ----------
 * 电子端：window.axhub.selectDir() 调主进程系统对话框，选完主进程会 reload 整页
 *         （openViewer -> loadURL），重载后 onMounted 重新 fetchTree，rootDir 自动展示。
 * 浏览器端：File System Access API（localhost/https 安全上下文可用），前端扫描目录，
 *         无需后端即可加载真实 AxHub 导出。扫描纯逻辑与服务端单源（scan-shared.js，
 *         vite build 将同一份文件内联进本 bundle），页面 ID 算法两端逐字节一致。 */
import AxHubScan from '../../scan-shared.js'

export async function scanDirHandle (dirHandle) {
  const pages = []
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== 'file') continue
    if (!/\.html?$/i.test(name)) continue
    if (AxHubScan.isFrameFile(name)) continue
    let file
    try { file = await handle.getFile() } catch (e) { continue }
    const base = AxHubScan.baseNameOf(name)
    pages.push({
      id: AxHubScan.computePageId(name),
      name: base, path: name, size: file.size, group: AxHubScan.groupOf(base), mtime: file.lastModified
    })
  }
  AxHubScan.sortPages(pages)
  return pages
}

export async function selectDirectory () {
  // 1) 电子端：主进程系统对话框选目录（选完 reload，rootDir 由 reload 后的 fetchTree 展示）
  if (window.axhub && typeof window.axhub.selectDir === 'function') {
    try {
      const p = await window.axhub.selectDir()
      if (p) message.success('已切换目录', 1.6)
      return p
    } catch (e) { message.error('选择目录失败：' + (e && e.message || e)); return null }
  }
  // 2) 浏览器端：File System Access API 前端扫描
  if (typeof window.showDirectoryPicker === 'function') {
    try {
      const handle = await window.showDirectoryPicker()
      const pages = await scanDirHandle(handle)
      mergeTree({ pages })
      store.rootDir = handle.name
      store.rootName = handle.name
      store.hasData = false
      store.loaded = true
      store.serverOk = true
      store.loadError = ''
      message.success('已加载目录：' + handle.name, 2)
      return handle.name
    } catch (e) {
      if (e && e.name === 'AbortError') return null
      message.error('选择目录失败：' + (e && e.message || e))
      return null
    }
  }
  message.warning('当前环境不支持选择目录：请用桌面端（npm start）或在 https/localhost 下访问', 3)
  return null
}

