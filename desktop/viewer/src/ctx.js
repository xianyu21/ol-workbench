import { reactive } from 'vue'

/* 全局右键菜单状态：App.vue 挂载单例 <ContextMenu/>，业务处 ctx.open(x,y,items) */
export const ctx = reactive({
  open: false,
  x: 0,
  y: 0,
  items: []   // [{key,label,icon,danger}] | {divider:true} | {header:'text'}
})

export function showCtx (x, y, items) {
  ctx.items = items
  ctx.x = x
  ctx.y = y
  ctx.open = true
}
export function hideCtx () { ctx.open = false }
