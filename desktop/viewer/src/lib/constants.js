/* ==========================================================================
 * 领域常量（纯数据，零依赖）：调色板、默认标签、原生导航页标识
 * ========================================================================== */

export const PALETTE = ['#1296db', '#16a34a', '#f97316', '#e5484d', '#8b5cf6', '#0891b2', '#db2777', '#65a30d', '#6366f1', '#ca8a04']

export const DEF_TAGS = [
  { name: '高频', color: '#1296db' }, { name: '待评审', color: '#f97316' },
  { name: '已确认', color: '#16a34a' }, { name: '问题', color: '#e5484d' }
]

/* 原生导航（AxHub 自带 index.html 框架）在工作台里以固定 id 的标签页承载 */
export const NATIVE_ID = 'native-index'
export const NATIVE_PAGE = { id: NATIVE_ID, name: 'AxHub 原生导航', path: 'index.html', native: true, group: '' }

/* 视图模式：与 router 的 /proto、/api 一一对应（持久化在 settings.viewMode） */
export const VIEW_MODES = ['proto', 'api']
