import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import App from './App.vue'
import SectionNode from './components/SectionNode.vue'
import 'ant-design-vue/dist/reset.css'
import './styles/global.css'

// 全量注册 antdv（桌面本地加载，无网络依赖）；主题主色在 App.vue ConfigProvider 定制
// SectionNode 在 Sidebar 中递归自引用，全局注册避免组件自引用解析问题
const app = createApp(App)
app.use(Antd)
app.component('SectionNode', SectionNode)
app.mount('#app')
