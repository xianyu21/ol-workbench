import { reactive, computed } from 'vue'
import { defineStore } from 'pinia'

/* ==========================================================================
 * 界面瞬时状态 store：弹窗显隐 + 全局右键菜单
 * 全部为运行时状态，不持久化（与业务数据严格分离）。
 * ========================================================================== */

export const useUiStore = defineStore('ui', () => {
  /* 弹窗/浮层：null 或 false 表示关闭 */
  const ui = reactive({
    renamePid: null,     // 重命名弹窗
    editTagsPid: null,   // 编辑标签弹窗
    tagManage: false,    // 标签管理
    backup: false,       // 备份/恢复
    settings: false,     // 设置
    importMd: null,      // API 视图导入 Markdown：null 关闭 / {} 新建 / {id,replace:true} 覆盖
    apiModule: null      // API 视图模块弹窗：{mode:'create'|'rename', id}
  })

  /* 右键菜单：App.vue 挂载单例 <ContextMenu/>，业务处 uiStore.showCtx(x,y,items) */
  const ctx = reactive({ open: false, x: 0, y: 0, items: [] })

  function showCtx (x, y, items) {
    ctx.items = items
    ctx.x = x
    ctx.y = y
    ctx.open = true
  }
  function hideCtx () { ctx.open = false }

  const ctxOpen = computed(() => ctx.open)

  return { ui, ctx, ctxOpen, showCtx, hideCtx }
})
