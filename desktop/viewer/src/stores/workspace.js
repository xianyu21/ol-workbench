import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { message } from 'ant-design-vue'
import * as userData from '@/lib/user-data.js'
import * as library from '@/lib/library.js'
import * as tabLifecycle from '@/lib/tabs.js'
import { host } from '@/host/index.js'
import { PALETTE, DEF_TAGS, NATIVE_ID, NATIVE_PAGE } from '@/lib/constants.js'
import { useTabsStore } from '@/stores/tabs.js'
import { useSettingsStore } from '@/stores/settings.js'

/* ==========================================================================
 * 工作区 store：AxHub 导出目录的页面清单 + 用户对页面的全部标注（收藏库）
 * 清单读取与目录选择经宿主语义接口 host，本 store 对运行环境零知识。
 * ========================================================================== */

export const useWorkspaceStore = defineStore('workspace', () => {
  const serverOk = ref(false)
  const rootName = ref('')
  const rootDir = ref('')
  const hasData = ref(false)
  const loadError = ref('')
  const loaded = ref(false)          // fetchTree 完成过一次
  const projects = ref(userData.get('projects', []))
  const tags = ref(userData.get('tags', DEF_TAGS))
  const q = ref('')                  // 侧栏搜索词（运行时，不持久化）
  const filterTags = ref([])         // 侧栏标签筛选（运行时）
  const secClosed = ref(userData.get('secClosed', {}))
  const recent = ref(userData.get('recent', []))

  function save () {
    userData.set('projects', projects.value)
    userData.set('tags', tags.value)
    userData.set('secClosed', secClosed.value)
    userData.set('recent', recent.value)
  }

  /* 整包归档：各 store 分别落自己的键，再合并触发一次防抖磁盘归档。
   * 历史上组件统一调 persist()，这里保留同一个入口以免调用点遗漏。 */
  function persist () {
    save()
    useSettingsStore().save()
    useTabsStore().save()
    userData.persist()
  }

  /* ---------- 工具 ---------- */
  function fmtSize (b) {
    if (!b) return ''
    if (b < 1024) return b + ' B'
    if (b < 1048576) return (b / 1024).toFixed(0) + ' KB'
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'
    return (b / 1073741824).toFixed(2) + ' GB'
  }
  function pad (n) { return n < 10 ? '0' + n : '' + n }

  function tagColor (name) {
    const t = tags.value.filter(x => x.name === name)[0]
    if (t) return t.color
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
    return PALETTE[h % PALETTE.length]
  }
  function ensureTag (name) {
    if (!name) return
    if (!tags.value.some(t => t.name === name)) tags.value.push({ name, color: tagColor(name) })
  }
  function hueOf (str) {
    let h = 0
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
    return PALETTE[h % PALETTE.length]
  }
  function initials (name) {
    const s = String(name)
    const m = s.match(/[一-龥]/)
    if (m) return m[0]
    return s.slice(0, 2).toUpperCase() || '?'
  }

  /* ---------- 页面查询 ---------- */
  function getP (id) {
    if (id === NATIVE_ID) return NATIVE_PAGE
    return projects.value.filter(p => p.id === id)[0]
  }

  /* 最近访问：固定 12 条上限（bump 由标签页打开/重指向触发） */
  function pushRecent (id) {
    const r = userData.get('recent', []).filter(x => x !== id)
    r.unshift(id)
    recent.value = r.slice(0, 12)
    userData.set('recent', recent.value)
  }

  /* ---------- 数据加载 ---------- */
  async function fetchTree () {
    loaded.value = true
    if (!host.supports('readPageManifest')) {
      serverOk.value = false
      loadError.value = '当前宿主无法读取页面清单'
      return
    }
    try {
      const data = await host.readPageManifest()
      serverOk.value = true
      if (data.error) { loadError.value = data.error; return }
      mergeTree(data)
      rootName.value = data.name
      rootDir.value = data.root || ''
      hasData.value = !!data.hasData
      loadError.value = ''
    } catch (e) {
      serverOk.value = false
      loadError.value = '无法读取页面清单'
    }
  }

  /* 清单重建 + 本地标注按路径保留；同时清理已不存在页面的标签页引用 */
  function mergeTree (data) {
    projects.value = library.mergeScannedPages(projects.value || [], data.pages || [], Date.now()).projects
    const tabStore = useTabsStore()
    const pruned = tabLifecycle.pruneTabs(
      tabStore.model(),
      pid => pid === NATIVE_ID || projects.value.some(p => p.id === pid)
    )
    if (pruned) tabStore.apply(pruned)
    persist()
  }

  /* 选择目录：宿主负责把结果带回来（桌面壳为 null，靠整页 reload 后重新供给清单；
   * headless 内存后端直接返回 pages 供测试；browser 后端已在 A 阶段裁剪） */
  async function selectDirectory () {
    if (!host.supports('chooseWorkspace')) {
      message.warning('当前环境不支持选择目录：请用桌面端（npm start）或在 https/localhost 下访问', 3)
      return null
    }
    try {
      const sel = await host.chooseWorkspace()
      if (!sel) return null // 用户取消
      if (sel.pages) {
        mergeTree({ pages: sel.pages })
        rootDir.value = sel.name
        rootName.value = sel.name
        hasData.value = false
        loaded.value = true
        serverOk.value = true
        loadError.value = ''
        message.success('已加载目录：' + sel.name, 2)
      } else {
        message.success('已切换目录', 1.6)
      }
      return sel.name
    } catch (e) {
      if (e && e.name === 'AbortError') return null
      message.error('选择目录失败：' + (e && e.message || e))
      return null
    }
  }

  /* ---------- 侧栏筛选/排序 ---------- */
  const visibleProjects = computed(() => {
    const kw = q.value.trim().toLowerCase()
    const favOnly = filterTags.value.indexOf('__fav') >= 0
    const need = filterTags.value.filter(t => t !== '__fav')
    return projects.value.filter(p => {
      if (favOnly && !p.fav) return false
      if (need.length) {
        const tg = p.tags || []
        for (let i = 0; i < need.length; i++) if (tg.indexOf(need[i]) < 0) return false
      }
      if (!kw) return true
      const hay = (p.name + ' ' + p.group + ' ' + (p.tags || []).join(' ')).toLowerCase()
      return kw.split(/\s+/).every(w => hay.indexOf(w) >= 0)
    }).sort((a, b) => {
      // 排序 UI 已移除：固定收藏置顶 + 名称排序
      if ((b.fav ? 1 : 0) !== (a.fav ? 1 : 0)) return (b.fav ? 1 : 0) - (a.fav ? 1 : 0)
      return a.name.localeCompare(b.name, 'zh')
    })
  })

  // 侧栏渲染结构：[{key,title,icon,items:[page],children:[sec],depth}]
  const sidebarSections = computed(() => {
    const list = visibleProjects.value
    const sections = []
    if (!projects.value.length || !list.length) return sections
    // 最近访问分组：固定 5 条、常驻展开，不参与全部展开/折叠
    const rc = recent.value.map(getP).filter(p => p && list.indexOf(p) >= 0).slice(0, 5)
    if (rc.length && !q.value.trim() && !filterTags.value.length) {
      sections.push({ key: '__recent', title: '最近访问', icon: 'clock', items: rc, children: [], fixed: true })
    }
    if (useSettingsStore().settings.group && !q.value.trim() && !filterTags.value.length) {
      buildTree(list).forEach(s => sections.push(s))
    } else {
      sections.push({ key: '__all', title: q.value.trim() ? '搜索结果' : '全部页面', icon: 'layers', items: list, children: [] })
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
    const groups = {}
    const order = []
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
  function toggleSection (key) {
    secClosed.value[key] = !secClosed.value[key]
    userData.set('secClosed', secClosed.value)
  }
  function collapseAll () {
    collectSectionKeys(sidebarSections.value).forEach(k => { secClosed.value[k] = true })
    userData.set('secClosed', secClosed.value)
  }
  function expandAll () {
    collectSectionKeys(sidebarSections.value).forEach(k => { secClosed.value[k] = false })
    userData.set('secClosed', secClosed.value)
  }
  // 找出某个页面所在的所有分组 key（从根到其直接父级），用于激活时自动展开祖先
  function ancestorKeysOfPid (sections, pid) {
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

  function renameProject (id, name) {
    const p = getP(id)
    if (!p || !name || !name.trim()) return
    p.name = name.trim()
    p.renamed = 1
    useTabsStore().renameSync(id, p.name)
  }

  return {
    serverOk, rootName, rootDir, hasData, loadError, loaded,
    projects, tags, q, filterTags, secClosed, recent,
    save, persist,
    fmtSize, pad, tagColor, ensureTag, hueOf, initials,
    getP, pushRecent,
    fetchTree, mergeTree, selectDirectory,
    visibleProjects, sidebarSections,
    toggleSection, collapseAll, expandAll, ancestorKeysOfPid,
    renameProject,
    PALETTE, DEF_TAGS, NATIVE_ID, NATIVE_PAGE
  }
})
