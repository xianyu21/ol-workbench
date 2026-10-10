/* ==========================================================================
 * 界面主题 module：偏好（auto/light/dark）持久化 + html[data-theme] 应用
 * auto 跟随系统 prefers-color-scheme（matchMedia 变化实时响应）。
 * antd 侧由 App.vue 读取 isDark 切换 darkAlgorithm。
 * ========================================================================== */
import { reactive, computed, watchEffect } from 'vue'
import * as userData from './user-data.js'

const mql = window.matchMedia('(prefers-color-scheme: dark)')
mql.addEventListener('change', e => { state.sys = e.matches })

export const state = reactive({ pref: userData.get('theme', 'auto'), sys: mql.matches })

/* 当前是否暗色：显式选择优先，auto 跟随系统 */
export const isDark = computed(() =>
  state.pref === 'dark' || (state.pref === 'auto' && state.sys)
)

/* 主题写入 html 根节点，全部 CSS 变量随之切换 */
watchEffect(() => {
  document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light'
})

export function setTheme (pref) {
  state.pref = pref
  userData.set('theme', pref) // set 内部已触发防抖落盘
}
