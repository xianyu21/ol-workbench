import { reactive, computed } from 'vue'
import { message } from 'ant-design-vue'

/* ==========================================================================
 * 全局状态 store（对应旧版 axhub-viewer.html 的 S 对象）
 * localStorage key 与旧版完全一致（wb_axhub_*），升级无缝继承历史数据
 * ========================================================================== */

const K = 'wb_axhub_'
function load (k, d) {
  try { const v = localStorage.getItem(K + k); return v == null ? d : JSON.parse(v) } catch (e) { return d }
}
function saveRaw (k, v) {
  try { localStorage.setItem(K + k, JSON.stringify(v)); return true } catch (e) { return false }
}

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
    { view: 'list', sort: 'name', maxAlive: 8, group: true, collapsed: false },
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
// 同源相对路径（server 根 = AxHub 目录）
export function enc (p) { return '/' + encodeURIComponent(p) }
export function srcOf (p) { return p.native ? '/index.html' : enc(p.path) }

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
    const r = await fetch('/_api/tree')
    const data = await r.json()
    store.serverOk = true
    if (data.error) { store.loadError = data.error; return }
    mergeTree(data)
    store.rootName = data.name
    store.rootDir = data.root || ''
    store.hasData = !!data.hasData
    store.loadError = ''
  } catch (e) {
    store.serverOk = false
    store.loadError = '无法连接本地服务'
  }
}
function mergeTree (data) {
  const local = {}
  ;(store.projects || []).forEach(p => { if (p.path) local[p.path] = p })
  store.projects = data.pages.map(p => {
    const l = local[p.path] || {}
    return {
      id: p.id, name: l.renamed ? l.name : p.name, path: p.path, group: p.group, size: p.size,
      tags: l.tags || [], fav: l.fav || 0, cover: l.cover || null, renamed: l.renamed || 0,
      openCount: l.openCount || 0, lastOpen: l.lastOpen || 0, addedAt: l.addedAt || Date.now()
    }
  })
  // 清理已不存在页面的标签页引用
  store.tabs = store.tabs.filter(t => store.projects.some(p => p.id === t.pid))
  if (store.active && !store.tabs.some(t => t.id === store.active)) store.active = store.tabs.length ? store.tabs[0].id : null
  persist()
}

/* ---------- 多标签 ---------- */
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
  const ex = tabOf(pid)
  if (ex && !forceNew) { setActive(ex.id); bump(p); return ex }
  const cur = activeTab.value
  let tab
  if (!forceNew && cur && !cur.pinned) {
    cur.pid = pid; cur.title = p.name; cur.native = !!p.native; cur.sleep = false; cur.loading = true
    tab = cur
    store.active = cur.id
  } else {
    tab = { id: 't' + (tabSeq.n++), pid, pinned: false, title: p.name, native: !!p.native, sleep: false, loading: true }
    saveRaw('tabSeq', tabSeq.n)
    store.tabs.push(tab)
    store.active = tab.id
  }
  bump(p); persist()
  return tab
}

export function setActive (id) {
  if (store.active === id) return
  store.active = id
  const t = store.tabs.filter(x => x.id === id)[0]
  if (t && t.sleep) t.sleep = false      // 唤醒由 ViewerPane 监听处理（重建 iframe）
  persist()
}

export function closeTab (id) {
  const i = store.tabs.findIndex(t => t.id === id)
  if (i < 0) return
  store.tabs.splice(i, 1)
  if (store.active === id) store.active = store.tabs.length ? store.tabs[Math.max(0, i - 1)].id : null
  persist()
}
export function togglePin (id) {
  const t = store.tabs.filter(x => x.id === id)[0]
  if (!t) return
  t.pinned = !t.pinned
  store.tabs = store.tabs.filter(x => x.pinned).concat(store.tabs.filter(x => !x.pinned))
  persist()
}
export function closeOthers (keep) { store.tabs.slice().forEach(t => { if (t.id !== keep && !t.pinned) closeTab(t.id) }) }
export function closeAllUnpinned () { store.tabs.slice().forEach(t => { if (!t.pinned) closeTab(t.id) }) }

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
    if ((b.fav ? 1 : 0) !== (a.fav ? 1 : 0)) return (b.fav ? 1 : 0) - (a.fav ? 1 : 0)
    const s = store.settings.sort
    if (s === 'name') return a.name.localeCompare(b.name, 'zh')
    if (s === 'hot') return (b.openCount || 0) - (a.openCount || 0)
    if (s === 'added') return (a.addedAt || 0) - (b.addedAt || 0)
    if (s === 'size') return (b.size || 0) - (a.size || 0)
    return (b.lastOpen || 0) - (a.lastOpen || 0) || a.name.localeCompare(b.name, 'zh')
  })
})

// 侧栏渲染结构：[{key,title,icon,items:[page],children:[sec],depth}]
export const sidebarSections = computed(() => {
  const list = visibleProjects.value
  const sections = []
  if (!store.projects.length || !list.length) return sections
  const recent = load('recent', []).map(getP).filter(p => p && list.indexOf(p) >= 0).slice(0, 6)
  if (recent.length && !store.q.trim() && !store.filterTags.length) {
    sections.push({ key: '__recent', title: '最近打开', icon: 'clock', items: recent, children: [] })
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

// 收集所有分组（含嵌套）的 key，用于全部折叠/展开
function collectSectionKeys (sections) {
  const out = []
  const walk = arr => arr.forEach(s => {
    out.push(s.key)
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
  store.tabs.forEach(t => { if (t.pid === id) t.title = p.name })
  persist()
}

/* ---------- 选择目录（页面内设置 / 顶栏触发） ----------
 * 电子端：window.axhub.selectDir() 调主进程系统对话框，选完主进程会 reload 整页
 *         （openViewer -> loadURL），重载后 onMounted 重新 fetchTree，rootDir 自动展示。
 * 浏览器端：File System Access API（localhost/https 安全上下文可用），前端扫描目录，
 *         无需后端即可加载真实 AxHub 导出。 */
const FRAME_FILES = new Set(['index.html', 'start.html', 'start_c_1.html', 'start_with_pages.html', '通用组件.html', 'start_with_pages (1).html'])

export async function scanDirHandle (dirHandle) {
  const pages = []
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== 'file') continue
    if (!/\.html?$/i.test(name)) continue
    const low = name.toLowerCase()
    if (FRAME_FILES.has(low)) continue
    if (/^start[^.]*\.html?$/i.test(name)) continue
    if (low === '通用组件.html') continue
    let file
    try { file = await handle.getFile() } catch (e) { continue }
    const base = name.replace(/\.html?$/i, '')
    const seg = base.split('-')
    const group = seg.length > 1 ? seg[0] : '未分组'
    let h = 5381
    for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) >>> 0
    pages.push({
      id: 'p' + h.toString(36) + '_' + name.length.toString(36),
      name: base, path: name, size: file.size, group, mtime: file.lastModified
    })
  }
  pages.sort((a, b) => a.path.localeCompare(b.path, 'zh'))
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

