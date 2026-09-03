<template>
  <a-modal :open="ui.settings" title="设置" ok-text="保存" cancel-text="取消"
    :width="560" @ok="ok" @cancel="ui.settings = false">
    <div class="rowsp dirblock">
      <div class="dirinfo">
        <b>AxHub 目录</b>
        <div class="hint">当前加载的原型导出根目录</div>
        <div class="dirpath" :title="store.rootDir">{{ store.rootDir || '未选择目录' }}</div>
      </div>
      <a-button type="primary" ghost @click="chooseDir">
        <template #icon><svg-icon name="folder" :size="14" /></template>
        选择目录
      </a-button>
    </div>
    <div class="rowsp">
      <div>
        <b>按模块分组</b>
        <div class="hint">按页面名编号前缀（00/01/...）分组</div>
      </div>
      <a-switch v-model:checked="st.group" />
    </div>
    <div class="fld" style="margin-top:14px">
      <div class="lbl">同时保活预览数：<b>{{ st.maxAlive }}</b></div>
      <a-slider v-model:value="st.maxAlive" :min="2" :max="24" :marks="{ 2: '2', 8: '8', 16: '16', 24: '24' }" />
      <div class="hint">已加载页面常驻内存，切换零延迟。超量时最久未用的<b>未固定</b>标签释放（固定的不释放）。体积大就调小。</div>
    </div>
    <div class="rowsp" style="margin-top:10px">
      <div>
        <b>版本与更新</b>
        <div class="hint">当前版本 v{{ appVersion }}<template v-if="lastCheck"> · 上次检查 {{ lastCheck }}</template></div>
      </div>
      <a-button :loading="checking" @click="checkUpdate">检查更新</a-button>
    </div>
    <a-collapse style="margin-top:8px">
      <a-collapse-panel key="kb" header="快捷键">
        <div class="kb">
          <code>Ctrl/⌘+K</code> 搜索 · <code>Ctrl/⌘+D</code> 固定 · <code>Ctrl/⌘+R</code> 刷新 ·
          <code>Ctrl/⌘+B</code> 侧栏 · <code>Alt+W</code> 关标签 · <code>Alt+1~9</code> 跳标签 ·
          <code>Alt+←/→</code> 切换 · 标签双击固定 · 中键关闭
        </div>
      </a-collapse-panel>
      <a-collapse-panel key="tech" header="技术栈 / 兼容性">
        <div class="kb">
          本工作台为<b>Electron 桌面端</b>：主进程内起零依赖本地服务（同源加载 AxHub 导出），
          渲染层为 <b>Vue 3 + Ant Design Vue</b>（Vite 构建产物）。<br><br>
          已兼容标准 AxHub/Axure 9 导出结构：<code>index.html</code> 为框架，顶级 <code>.html</code> 为各业务页面，
          <code>resources/ data/ images/ files/</code> 共享。iframe 同源加载，相对路径资源全部正常。
        </div>
      </a-collapse-panel>
    </a-collapse>
  </a-modal>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { store, persist, selectDirectory } from '../../store.js'
import { ui } from '../../ui.js'
import SvgIcon from '../SvgIcon.vue'

const st = store.settings

const appVersion = ref('…')
const checking = ref(false)
const lastCheck = ref('')

onMounted(async () => {
  if (window.axhub?.version) appVersion.value = await window.axhub.version()
})

async function checkUpdate () {
  if (!window.axhub?.checkUpdate) { message.warning('当前环境不支持在线更新'); return }
  checking.value = true
  try {
    const r = await window.axhub.checkUpdate()
    lastCheck.value = new Date().toLocaleTimeString()
    if (!r || !r.ok) { message.error(r && r.error || '检查更新失败'); return }
    if (r.available) {
      // 主进程已弹窗展示更新内容并询问是否下载
      message.info(`发现新版本 v${r.version}，请在弹窗中确认下载`)
    } else {
      message.success(`已是最新版本（v${appVersion.value}）`)
    }
  } finally {
    checking.value = false
  }
}

function chooseDir () { selectDirectory() }
function ok () {
  st.maxAlive = Math.max(2, Math.min(24, +st.maxAlive || 8))
  persist()
  ui.settings = false
  message.success('设置已保存')
}
</script>

<style scoped>
.rowsp{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-2)}
.dirblock{padding-top:2px}
.dirinfo{display:flex;flex-direction:column;gap:3px;min-width:0}
.dirpath{font-size:12px;color:var(--primary-2);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-top:2px}
.rowsp b{font-size:13px;font-weight:600}
.fld{margin-bottom:6px}
.lbl{font-size:12.5px;font-weight:600;color:var(--text-2);margin-bottom:6px}
.hint{font-size:11.5px;color:var(--muted);margin-top:4px;line-height:1.55}
.kb{font-size:12.5px;color:var(--text-2);line-height:1.8}
.kb code{font-size:11.5px;background:var(--panel-3);padding:1px 5px;border-radius:4px;color:var(--primary-2)}
</style>
