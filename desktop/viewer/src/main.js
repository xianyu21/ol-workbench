import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import '@/assets/styles/global.css'

import App from '@/App.vue'
import router from '@/router/index.js'
import SectionNode from '@/components/proto/SectionNode.vue'
import { useSettingsStore } from '@/stores/index.js'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(Antd)
// SectionNode 在 Sidebar 中递归自引用，全局注册避免组件自引用解析问题
app.component('SectionNode', SectionNode)

/* 启动时把上次记住的视图模式恢复成路由（settings.viewMode 仍是持久化事实来源） */
router.isReady().then(() => {
  const saved = useSettingsStore(pinia).settings.viewMode
  const cur = router.currentRoute.value.params.view
  if (saved && saved !== cur) router.replace('/' + saved)
  app.mount('#app')
})
