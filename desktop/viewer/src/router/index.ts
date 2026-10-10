import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import ProtoWorkspace from '@/views/ProtoWorkspace.vue'
import ApiWorkspace from '@/views/ApiWorkspace.vue'

/* ==========================================================================
 * 路由：两个工作区（原型预览 / 接口文档）
 *
 * 设计说明（与常规 SPA 不同，是有意为之）：
 * 两条路由**同时**声明 default 与 api 两个命名视图，App.vue 用两个 <router-view>
 * 常驻渲染它们，再由当前路由参数决定谁可见（v-show）。
 * 原因：原型视图的 TabBar/ViewerPane 持有活的 iframe；若按常规做法让 <router-view>
 * 在切换时卸载组件，iframe 会被移出 DOM 并重新加载，已打开的原型页面状态全部丢失。
 * 因此这里「路由负责状态与深链，常驻挂载负责保活」，保活语义写在 App.vue 注释里。
 *
 * 用 hash 模式：桌面端跑在自定义协议 axhub:// 下，hash 不依赖服务端 rewrite。
 * ========================================================================== */

const routes: RouteRecordRaw[] = [
  {
    path: '/:view(proto|api)',
    name: 'workspace',
    components: { default: ProtoWorkspace, api: ApiWorkspace },
    props: { default: false, api: false }
  },
  { path: '/:pathMatch(.*)*', redirect: '/proto' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
