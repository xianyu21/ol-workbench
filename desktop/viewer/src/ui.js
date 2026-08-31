import { reactive } from 'vue'

/* 弹窗/浮层 UI 状态（不属于持久化数据） */
export const ui = reactive({
  renamePid: null,     // 重命名弹窗
  editTagsPid: null,   // 编辑标签弹窗
  tagManage: false,    // 标签管理
  backup: false,       // 备份/恢复
  settings: false      // 设置
})
