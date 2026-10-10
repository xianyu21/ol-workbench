<template>
  <a-config-provider :theme="themeCfg" :locale="zhCN">
    <div class="shell">
      <!-- 顶栏 -->
      <header class="topbar">
        <div class="brand">
          <button class="logo" :title="settings.collapsed ? '展开侧栏 (Ctrl+B)' : '收起侧栏 (Ctrl+B)'"
            @click="toggleSidebar"><svg-icon name="layers" :size="16" /></button>
          <span>AxHub 原型工作台</span>
          <small>桌面版</small>
        </div>
        <div class="hd-sp" />
        <a-button size="middle" @click="openNative">
          <template #icon><svg-icon name="box" :size="15" /></template>
          <span class="hd-lbl">AxHub 导航</span>
        </a-button>
        <a-tooltip title="选择 AxHub 导出目录">
          <a-button type="primary" @click="ws.selectDirectory">
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
        <a-tooltip title="恢复备份">
          <a-button @click="ui.backup = true"><template #icon><svg-icon name="box" :size="15" /></template></a-button>
        </a-tooltip>
        <a-tooltip title="设置">
          <a-button @click="ui.settings = true"><template #icon><svg-icon name="gear" :size="15" /></template></a-button>
        </a-tooltip>
      </header>

      <!-- 未选择目录 / 空目录引导条 -->
      <div v-if="!isApi && ws.loaded && !ws.projects.length && !ws.loadError" class="emptybar">
        <svg-icon name="folder" :size="16" />
        <span>尚未加载 AxHub 原型导出目录</span>
        <a-button type="primary" size="small" @click="ws.selectDirectory">选择目录</a-button>
      </div>

      <main class="main">
        <!-- 最左侧图标窄栏：原型视图 / API 视图 -->
        <ViewRail />
        <!--
          两个工作区同时挂载，由当前路由决定谁可见（v-show）。
          注意：这里**不能**改用单个 <router-view> 让组件在切换时卸载 —— 原型视图的
          ViewerPane 持有活的 iframe，一旦被移出 DOM 就会重新加载，已打开页面的交互
          状态全部丢失。因此路由只负责「视图状态 + 深链」，保活由常驻挂载负责。
          关键：v-show 必须加在「单根包裹层」上，不能直接加在 <router-view> 上 —— 两个
          工作区组件都是多根节点（fragment：侧栏 + 内容区），v-show 加在 router-view 只会
          隐藏其第一个根（侧栏），内容区（含 iframe）仍留在 DOM，与另一视图重叠互串，
          表现即「两视图不共存」。包一层单根 div 后整块一起显隐，且仍是 v-show 不卸载。
        -->
        <div v-show="!isApi" class="ws-pane">
          <router-view />
        </div>
        <div v-show="isApi" class="ws-pane">
          <router-view name="api" />
        </div>
      </main>

      <!-- 弹窗组 -->
      <ContextMenu />
      <RenameModal />
      <EditTagsModal />
      <TagManageModal />
      <BackupModal />
      <SettingsModal />
      <ImportMdModal />
      <ModuleNameModal />

      <!-- 无 AxHub 目录引导弹窗：每次打开应用时若未关联目录都会弹出 -->
      <a-modal :open="noDirTip" title="添加 AxHub 原型目录" :width="460" :closable="false"
        :maskClosable="false" :keyboard="false" :zIndex="2000">
        <div class="nodir">
          <div class="nd-msg">工作台还没有关联 AxHub 导出目录，添加后即可在左侧浏览全部原型页面。</div>
          <div class="nd-step"><b>添加入口：</b></div>
          <ol class="nd-list">
            <li>点击顶栏右侧的「<b>选择目录</b>」按钮；</li>
            <li>或打开右上角「<svg-icon name="gear" :size="11" /> 设置」→ AxHub 目录 → 选择目录。</li>
          </ol>
          <div class="nd-tip">请选择 <b>AxHub / Axure 9 标准导出文件夹</b>（含 index.html 框架、多个 .html 页面及
            resources / data 等共享目录）。工作台只读浏览，不会改动磁盘文件。</div>
        </div>
        <template #footer>
          <div class="nd-btns">
            <a-button @click="noDirTip = false">稍后再说</a-button>
            <a-button type="primary" :loading="dirPicking" @click="pickNow">
              <template #icon><svg-icon name="folder" :size="14" /></template>
              选择目录
            </a-button>
          </div>
        </template>
      </a-modal>

      <!-- 关闭行为询问（Electron 点 X 且未记住选择时） -->
      <a-modal :open="closeAsk" title="关闭 AxHub 原型工作台" :width="420" :closable="true"
        :maskClosable="true" @cancel="closeAsk = false">
        <div class="close-ask">
          <div class="ca-q">要在后台继续运行，还是直接退出？</div>
          <div class="ca-hint">后台运行将最小化到系统托盘，可随时从托盘重新打开。</div>
          <a-checkbox v-model:checked="closeRemember">记住我的选择，以后不再询问</a-checkbox>
        </div>
        <template #footer>
          <div class="ca-btns">
            <a-button type="primary" @click="applyClose('background')">
              <template #icon><svg-icon name="layers" :size="14" /></template>
              后台运行
            </a-button>
            <a-button danger @click="applyClose('exit')">直接退出</a-button>
            <a-button @click="closeAsk = false">取消</a-button>
          </div>
        </template>
      </a-modal>

      <!-- 后台静默下载：右下角非模态进度提示（不遮挡、不打断操作） -->
      <div v-if="updatePct !== null" class="upd-toast">
        <a-progress :percent="updatePct" size="small" status="active" :show-info="false" />
        <div class="ut-txt">正在后台下载更新<template v-if="updateVer"> v{{ updateVer }}</template> · {{ updatePct }}%</div>
      </div>

      <!-- 更新已就绪：可立即重启安装，未操作则退出应用时自动安装 -->
      <div v-if="updateReady" class="upd-ready">
        <svg-icon name="box" :size="15" />
        <span class="ur-txt">新版本<template v-if="readyVer"> v{{ readyVer }}</template> 已下载完成，重启后生效</span>
        <a-button type="primary" size="small" @click="installNow">立即重启安装</a-button>
        <a-button size="small" type="text" @click="updateReady = false">稍后</a-button>
      </div>
    </div>
  </a-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { message, theme as antdTheme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'

import SvgIcon from '@/components/common/SvgIcon.vue'
import ContextMenu from '@/components/common/ContextMenu.vue'
import ViewRail from '@/components/common/ViewRail.vue'
import RenameModal from '@/components/modals/RenameModal.vue'
import EditTagsModal from '@/components/modals/EditTagsModal.vue'
import TagManageModal from '@/components/modals/TagManageModal.vue'
import BackupModal from '@/components/modals/BackupModal.vue'
import SettingsModal from '@/components/modals/SettingsModal.vue'
import ImportMdModal from '@/components/modals/ImportMdModal.vue'
import ModuleNameModal from '@/components/modals/ModuleNameModal.vue'

import { useWorkspaceStore, useSettingsStore, useUiStore } from '@/stores'
import { useHostSignals } from '@/composables/useHostSignals'
import { useShortcuts, openNativeNav } from '@/composables/useShortcuts'
import { isDark } from '@/lib/theme.js'

const route = useRoute()
const ws = useWorkspaceStore()
const settingsStore = useSettingsStore()
const { settings } = settingsStore
const { ui } = useUiStore()

/* 当前视图由路由决定；settings.viewMode 只做持久化，跟随路由同步 */
const isApi = computed(() => route.params.view === 'api')
watch(isApi, v => {
  settingsStore.setViewMode(v ? 'api' : 'proto')
  // 切回原型视图：TabBar 隐藏期间 clientWidth 为 0，需触发一次 resize 重算溢出箭头
  if (!v) nextTick(() => window.dispatchEvent(new Event('resize')))
}, { immediate: true })

/* antd 主题 token：跟随 theme.js 的 isDark 切换 darkAlgorithm */
const tokens = { colorPrimary: '#1296db', colorInfo: '#1296db', borderRadius: 7, fontFamily: 'var(--font)' }
const themeCfg = computed(() => isDark.value
  ? { algorithm: antdTheme.darkAlgorithm, token: tokens }
  : { token: tokens }
)

/* ---------- 宿主信号：关闭询问 / 后台更新 ---------- */
const {
  closeAsk, closeRemember, updatePct, updateVer, readyVer, updateReady, applyClose, installNow
} = useHostSignals()

/* ---------- 快捷键 ---------- */
const { toggleSidebar } = useShortcuts(isApi)

function rescan () {
  message.info('正在重新扫描目录…', 1.5)
  ws.loaded = false
  ws.fetchTree()
}
function openNative () {
  if (openNativeNav()) message.success('已打开 AxHub 原生导航', 1.8)
}

/* 无 AxHub 目录引导弹窗：每次打开（重载/重启）时若仍未关联目录都弹出 */
const noDirTip = ref(false)
const dirPicking = ref(false)
async function pickNow () {
  dirPicking.value = true
  try {
    const name = await ws.selectDirectory() // 选择成功由主进程重载进工作台；取消则留在弹窗
    if (name) noDirTip.value = false // 选择成功（含 reload 前）立即关闭引导弹窗
  } finally {
    dirPicking.value = false
  }
}

onMounted(() => {
  ws.fetchTree().then(() => {
    // 加载完成且未关联任何目录 → 弹出添加引导（每次都弹，直到关联目录）
    // API 视图下不弹：该弹窗引导的是原型目录，与接口文档无关
    if (!ws.rootDir && !ws.loadError && !isApi.value) noDirTip.value = true
  })
})
</script>

<style scoped>
.shell{height:100%;display:flex;flex-direction:column}
.topbar{flex:0 0 auto;height:50px;display:flex;align-items:center;gap:8px;padding:0 12px;background:var(--panel);border-bottom:1px solid var(--border);box-shadow:var(--sh-1);position:relative;z-index:40}
.brand{display:flex;align-items:center;gap:9px;font-weight:650;font-size:15px;letter-spacing:.2px;white-space:nowrap;color:var(--text)}
.brand .logo{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#1296db,#0d7cad);box-shadow:0 2px 8px rgba(18,150,219,.32);border:none;padding:0;cursor:pointer;transition:transform .12s,box-shadow .12s}
.brand .logo:hover{transform:scale(1.08);box-shadow:0 3px 12px rgba(18,150,219,.45)}
.brand .logo:active{transform:scale(.95)}
.brand small{font-weight:500;color:var(--muted);font-size:11px;margin-left:2px}
.hd-sp{flex:1 1 auto}
.bkbar{flex:0 0 auto;display:flex;align-items:center;gap:9px;padding:6px 12px;font-size:12.5px;background:var(--warn-soft);border-bottom:1px solid var(--warn-border);color:var(--warn-text)}
.bkbar .sp{flex:1 1 auto}
.emptybar{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:10px 14px;font-size:13px;background:var(--panel-3);border-bottom:1px solid var(--border);color:var(--text-2)}
.emptybar .sp{flex:1 1 auto}
.main{flex:1 1 auto;display:flex;min-height:0;position:relative}
/* 工作区单根包裹层：v-show 作用于此整块（含 iframe），保证两个视图干净切换、互不重叠 */
.ws-pane{flex:1 1 auto;display:flex;min-width:0;min-height:0}
@media(max-width:860px){.hd-lbl{display:none}}
.close-ask{display:flex;flex-direction:column;gap:10px;padding-top:2px}
.ca-q{font-size:14px;font-weight:600;color:var(--text)}
.ca-hint{font-size:12.5px;color:var(--muted);line-height:1.6;margin-bottom:2px}
.ca-btns{display:flex;gap:8px;justify-content:flex-end}
/* 后台静默下载：右下角非模态小卡（不遮挡、不拦截操作） */
.upd-toast{position:fixed;right:16px;bottom:16px;z-index:1500;width:260px;padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--border);box-shadow:var(--sh-2,0 6px 20px rgba(0,0,0,.12))}
.ut-txt{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.5}
/* 更新已就绪：底部提示条（可立即重启，或退出时自动安装） */
.upd-ready{position:fixed;right:16px;bottom:16px;z-index:1500;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:var(--panel);border:1px solid var(--border);box-shadow:var(--sh-2,0 6px 20px rgba(0,0,0,.12));color:var(--text)}
.upd-ready .ur-txt{font-size:12.5px;color:var(--text-2)}
.nodir{display:flex;flex-direction:column;gap:10px;padding-top:4px}
.nd-msg{font-size:13.5px;color:var(--text-2);line-height:1.7}
.nd-step{font-size:13px;color:var(--text)}
.nd-list{margin:0;padding-left:22px;font-size:13px;color:var(--text-2);line-height:2;display:flex;flex-direction:column;gap:2px}
.nd-tip{font-size:12px;color:var(--muted);line-height:1.7;background:var(--panel-3);border-radius:8px;padding:10px 12px}
.nd-btns{display:flex;gap:8px;justify-content:flex-end}
</style>
