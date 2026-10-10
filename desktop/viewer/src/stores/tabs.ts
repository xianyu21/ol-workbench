import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import * as userData from '@/lib/user-data.js'
import * as tabLifecycle from '@/lib/tabs.js'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'

/* ==========================================================================
 * 标签页 store：生命周期的**决策**在 lib/tabs.js（零依赖纯函数），
 * 本 store 只做响应式 adapter：把纯函数返回的新状态赋回并落盘。
 * invariant「激活标签永不休眠」由 tabs.js 的构造保证。
 * ========================================================================== */

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref(userData.get('tabs', []))   // [{id,pid,pinned,title,native,sleep,loading,src,rc,lastActive}]
  const active = ref(userData.get('active', null))
  const seq = ref(userData.get('tabSeq', 1))

  function save () {
    userData.set('tabs', tabs.value)
    userData.set('active', active.value)
    userData.set('tabSeq', seq.value)
  }

  /* 交给 lib/tabs.js 的状态模型（纯数据快照） */
  function model () { return { tabs: tabs.value, active: active.value, tabSeq: { n: seq.value } } }
  function apply (r) {
    if (!r) return
    if (r.tabs !== undefined) tabs.value = r.tabs
    if (r.active !== undefined) active.value = r.active
    if (r.tabSeq) seq.value = r.tabSeq.n
    save()
  }

  /* 页面 URL 词汇由 lib/tabs.js 单源（自导航/链接拦截与标签页共用） */
  const enc = tabLifecycle.enc
  const srcOf = tabLifecycle.srcOf

  const activeTab = computed(() => tabs.value.filter(t => t.id === active.value)[0] || null)
  function getP (id) { return useWorkspaceStore().getP(id) }
  function tabOf (pid) { return tabs.value.filter(t => t.pid === pid)[0] }

  /* 打开计数 / 最近访问：计数落在页面对象上，最近访问交给 workspace store */
  function bump (p) {
    if (!p || p.native) return
    p.openCount = (p.openCount || 0) + 1
    p.lastOpen = Date.now()
    useWorkspaceStore().pushRecent(p.id)
  }

  // forceNew=true 强制新标签；否则复用未固定的当前标签（浏览器式替换）
  function openProject (pid, forceNew) {
    const p = getP(pid)
    if (!p) return null
    apply(tabLifecycle.open(model(), { id: p.id, name: p.name, native: p.native }, { forceNew, now: Date.now() }))
    bump(p)
    return tabOf(pid)
  }

  function setActive (id) {
    if (active.value === id) return
    apply(tabLifecycle.setActive(model(), id, Date.now()))
  }
  function wakeTab (id) { apply(tabLifecycle.wake(model(), id, Date.now())) }
  function closeTab (id) { apply(tabLifecycle.close(model(), id)) }
  function togglePin (id) { apply(tabLifecycle.togglePin(model(), id)) }
  function reorderTab (dragId, targetId) { apply(tabLifecycle.reorder(model(), dragId, targetId)) }
  function reloadTab (id) { apply(tabLifecycle.reload(model(), id)) }
  function markLoaded (id) { apply(tabLifecycle.markLoaded(model(), id)) }
  function sweepLru () { apply(tabLifecycle.lruSweep(model(), useSettingsStore().settings.maxAlive)) }
  function restoreSessionTabs () { apply(tabLifecycle.restoreSession(model())) }
  function retargetTab (id, page) {
    apply(tabLifecycle.retargetSelfNav(model(), id, page))
    bump(page)
  }
  function closeOthers (keep) { apply(tabLifecycle.closeOthers(model(), keep)) }
  function closeAllUnpinned () { apply(tabLifecycle.closeAllUnpinned(model())) }
  function renameSync (pid, name) { apply(tabLifecycle.renameSync(model(), pid, name)) }

  return {
    tabs, active, seq,
    save, model, apply,
    enc, srcOf, activeTab, getP, tabOf, bump,
    openProject, setActive, wakeTab, closeTab, togglePin, reorderTab, reloadTab,
    markLoaded, sweepLru, restoreSessionTabs, retargetTab, closeOthers, closeAllUnpinned,
    renameSync
  }
})
