<template>
  <a-config-provider :theme="theme" :locale="zhCN">
    <div class="shell">
      <!-- 顶栏 -->
      <header class="topbar">
        <div class="brand">
          <span class="logo"><svg-icon name="layers" :size="16" /></span>
          <span>AxHub 原型工作台</span>
          <small>桌面版</small>
        </div>
        <div class="hd-sp" />
        <a-button size="middle" @click="openNative">
          <template #icon><svg-icon name="box" :size="15" /></template>
          <span class="hd-lbl">AxHub 导航</span>
        </a-button>
        <a-tooltip title="选择 AxHub 导出目录">
          <a-button type="primary" @click="selectDirectory">
            <template #icon><svg-icon name="folder" :size="15" /></template>
            <span class="hd-lbl">选择目录</span>
          </a-button>
        </a-tooltip>
        <a-tooltip title="重新扫描目录">
          <a-button @click="rescan"><template #icon><svg-icon name="refresh" :size="15" /></template></a-button>
        </a-tooltip>
        <a-tooltip title="标签管理">
          <a-button @click="ui.tagManage = true"><template #icon><svg-icon name="tag" :size="15" /></template></a-button>
        </a-tooltip>
        <a-tooltip title="备份 / 恢复">
          <a-button @click="ui.backup = true"><template #icon><svg-icon name="box" :size="15" /></template></a-button>
        </a-tooltip>
        <a-tooltip title="设置">
          <a-button @click="ui.settings = true"><template #icon><svg-icon name="gear" :size="15" /></template></a-button>
        </a-tooltip>
      </header>

      <!-- 备份提示条 -->
      <div v-if="store.bkTip" class="bkbar">
        <svg-icon name="warn" :size="15" />
        <span>{{ store.bkTip }}</span>
        <span class="sp" />
        <a-button type="link" size="small" @click="ui.backup = true">立即导出</a-button>
        <a-button type="link" size="small" @click="dismissBackup">知道了</a-button>
      </div>

      <!-- 未选择目录 / 空目录引导条 -->
      <div v-if="store.loaded && !store.projects.length && !store.loadError" class="emptybar">
        <svg-icon name="folder" :size="16" />
        <span>尚未加载 AxHub 原型导出目录</span>
        <a-button type="primary" size="small" @click="selectDirectory">选择目录</a-button>
      </div>

      <main class="main">
        <Sidebar />
        <section class="content">
          <TabBar />
          <ViewerPane />
        </section>
      </main>

      <!-- 弹窗组 -->
      <ContextMenu />
      <RenameModal />
      <EditTagsModal />
      <TagManageModal />
      <BackupModal />
      <SettingsModal />
    </div>
  </a-config-provider>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { message } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import SvgIcon from './components/SvgIcon.vue'
import ContextMenu from './components/ContextMenu.vue'
import Sidebar from './components/Sidebar.vue'
import TabBar from './components/TabBar.vue'
import ViewerPane from './components/ViewerPane.vue'
import RenameModal from './components/modals/RenameModal.vue'
import EditTagsModal from './components/modals/EditTagsModal.vue'
import TagManageModal from './components/modals/TagManageModal.vue'
import BackupModal from './components/modals/BackupModal.vue'
import SettingsModal from './components/modals/SettingsModal.vue'
import { store, persist, fetchTree, openProject, setActive, closeTab, togglePin, selectDirectory, NATIVE_ID } from './store.js'
import { ui } from './ui.js'

const theme = { token: { colorPrimary: '#1296db', colorInfo: '#1296db', borderRadius: 7, fontFamily: 'var(--font)' } }

function rescan () {
  message.info('正在重新扫描目录…', 1.5)
  store.loaded = false
  fetchTree()
}
function dismissBackup () {
  store.settings.hideBackupTip = true
  store.bkTip = ''
  persist()
}
function openNative () {
  const ex = store.tabs.filter(t => t.pid === NATIVE_ID)[0]
  if (ex) { setActive(ex.id); return }
  openProject(NATIVE_ID, true)
  message.success('已打开 AxHub 原生导航', 1.8)
}

/* ---------- 快捷键（与旧版一致） ---------- */
function onKey (e) {
  const mod = e.ctrlKey || e.metaKey
  if (e.key === 'Escape') return
  if (mod && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); window.dispatchEvent(new Event('ax-focus-search')); return }
  if (mod && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); const t = store.tabs.filter(x => x.id === store.active)[0]; if (t) togglePin(t.id); return }
  if (mod && (e.key === 'r' || e.key === 'R')) { if (store.tabs.length) { e.preventDefault(); window.dispatchEvent(new Event('ax-reload-active')) } return }
  if (mod && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); if (innerWidth > 860) { store.settings.collapsed = !store.settings.collapsed; persist() } return }
  if (e.altKey && (e.key === 'w' || e.key === 'W')) { e.preventDefault(); if (store.active) closeTab(store.active); return }
  if (e.altKey && e.key >= '1' && e.key <= '9') { e.preventDefault(); const i = +e.key - 1; if (store.tabs[i]) setActive(store.tabs[i].id); return }
  if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault()
    const idx = store.tabs.findIndex(t => t.id === store.active)
    if (idx < 0) return
    let n = e.key === 'ArrowLeft' ? idx - 1 : idx + 1
    if (n < 0) n = store.tabs.length - 1
    if (n >= store.tabs.length) n = 0
    if (store.tabs[n]) setActive(store.tabs[n].id)
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKey)
  fetchTree()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.shell{height:100%;display:flex;flex-direction:column}
.topbar{flex:0 0 auto;height:50px;display:flex;align-items:center;gap:8px;padding:0 12px;background:var(--panel);border-bottom:1px solid var(--border);box-shadow:var(--sh-1);position:relative;z-index:40}
.brand{display:flex;align-items:center;gap:9px;font-weight:650;font-size:15px;letter-spacing:.2px;white-space:nowrap;color:var(--text)}
.brand .logo{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#1296db,#0d7cad);box-shadow:0 2px 8px rgba(18,150,219,.32)}
.brand small{font-weight:500;color:var(--muted);font-size:11px;margin-left:2px}
.hd-sp{flex:1 1 auto}
.bkbar{flex:0 0 auto;display:flex;align-items:center;gap:9px;padding:6px 12px;font-size:12.5px;background:var(--warn-soft);border-bottom:1px solid #ffd9bd;color:#8a4b12}
.bkbar .sp{flex:1 1 auto}
.emptybar{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:10px 14px;font-size:13px;background:var(--panel-3);border-bottom:1px solid var(--border);color:var(--text-2)}
.emptybar .sp{flex:1 1 auto}
.main{flex:1 1 auto;display:flex;min-height:0;position:relative}
.content{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--bg)}
@media(max-width:860px){.hd-lbl{display:none}}
</style>
