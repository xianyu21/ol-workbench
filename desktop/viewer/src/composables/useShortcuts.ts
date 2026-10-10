import { onMounted, onBeforeUnmount } from 'vue'
import { useWorkspaceStore, useTabsStore, useSettingsStore } from '@/stores/index'
import { NATIVE_ID } from '@/lib/constants.js'

/* ==========================================================================
 * 全局快捷键（与旧版一致）
 * Ctrl/⌘+K 搜索 · Ctrl/⌘+D 固定 · Ctrl/⌘+R 刷新 · Ctrl/⌘+B 侧栏
 * Alt+W 关标签 · Alt+1~9 跳标签 · Alt+←/→ 切换
 * 标签类快捷键在 API 视图下不生效（由 isApi 决定）。
 * ========================================================================== */
export function useShortcuts (isApi) {
  const ws = useWorkspaceStore()
  const tabStore = useTabsStore()
  const settingsStore = useSettingsStore()

  /* 顶栏 logo / Ctrl+B：收起 ↔ 展开（收起态恢复由 Sidebar 监听 ax-restore-sidebar） */
  function toggleSidebar () {
    if (settingsStore.settings.collapsed) {
      window.dispatchEvent(new Event('ax-restore-sidebar'))
      return
    }
    if (window.innerWidth > 860) { settingsStore.settings.collapsed = true; settingsStore.save() }
  }

  function onKey (e) {
    const mod = e.ctrlKey || e.metaKey
    if (e.key === 'Escape') return
    const api = !!(isApi && isApi.value)
    // Ctrl+K：两视图各自聚焦自己的搜索框
    if (mod && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault()
      window.dispatchEvent(new Event(api ? 'ax-focus-api-search' : 'ax-focus-search'))
      return
    }
    if (mod && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); toggleSidebar(); return }
    // 以下是原型标签页语义，API 视图下不生效
    if (api) return
    if (mod && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault()
      const t = tabStore.tabs.filter(x => x.id === tabStore.active)[0]
      if (t) tabStore.togglePin(t.id)
      return
    }
    if (mod && (e.key === 'r' || e.key === 'R')) {
      if (tabStore.tabs.length) { e.preventDefault(); window.dispatchEvent(new Event('ax-reload-active')) }
      return
    }
    if (e.altKey && (e.key === 'w' || e.key === 'W')) {
      e.preventDefault()
      if (tabStore.active) tabStore.closeTab(tabStore.active)
      return
    }
    if (e.altKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault()
      const i = +e.key - 1
      if (tabStore.tabs[i]) tabStore.setActive(tabStore.tabs[i].id)
      return
    }
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      const idx = tabStore.tabs.findIndex(t => t.id === tabStore.active)
      if (idx < 0) return
      let n = e.key === 'ArrowLeft' ? idx - 1 : idx + 1
      if (n < 0) n = tabStore.tabs.length - 1
      if (n >= tabStore.tabs.length) n = 0
      if (tabStore.tabs[n]) tabStore.setActive(tabStore.tabs[n].id)
    }
  }

  onMounted(() => document.addEventListener('keydown', onKey))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

  return { toggleSidebar }
}

/* 顶栏「AxHub 导航」：打开/激活原生导航标签 */
export function openNativeNav () {
  const tabStore = useTabsStore()
  const ex = tabStore.tabs.filter(t => t.pid === NATIVE_ID)[0]
  if (ex) { tabStore.setActive(ex.id); return false }
  tabStore.openProject(NATIVE_ID, true)
  return true
}
