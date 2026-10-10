import { reactive } from 'vue'
import { defineStore } from 'pinia'
import * as userData from '@/lib/user-data.js'

/* ==========================================================================
 * 界面设置 store
 * viewMode（proto|api）与 router 路径同源：路由改动由此 store 跟随持久化，
 * 启动时由 router 读取它决定初始路由。
 * ========================================================================== */

export const DEFAULT_SETTINGS = {
  view: 'list',        // 侧栏条目密度（历史字段，保留兼容）
  maxAlive: 8,         // LRU 保活 iframe 上限
  group: true,         // 侧栏按编号前缀分组
  collapsed: false,    // 侧栏收起
  closeAction: '',     // 关闭行为：'' | 'background' | 'exit'
  silentUpdate: true,  // 后台静默下载
  viewMode: 'proto'    // 当前视图：proto | api
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = reactive(Object.assign({}, DEFAULT_SETTINGS, userData.get('settings', {})))

  function save () { userData.set('settings', settings) }

  function setViewMode (v) {
    if (settings.viewMode === v) return
    settings.viewMode = v
    save()
  }

  function setCollapsed (v) {
    if (settings.collapsed === v) return
    settings.collapsed = v
    save()
  }

  return { settings, save, setViewMode, setCollapsed }
})
