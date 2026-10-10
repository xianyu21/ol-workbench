<template>
  <a-modal :open="ui.settings" title="设置" ok-text="完成" cancel-text="关闭"
    :width="740" :body-style="{ padding: '0' }" @ok="ok" @cancel="ui.settings = false">
    <div class="set2">
      <nav class="set-nav">
        <button v-for="c in cats" :key="c.key" class="cat" :class="{ on: active === c.key }" @click="active = c.key">
          <svg-icon :name="c.icon" :size="16" /><span>{{ c.name }}</span>
        </button>
      </nav>
      <div class="set-body">
        <!-- 工作目录 -->
        <section v-show="active === 'dir'" class="set-sec">
          <div class="sec-h"><svg-icon name="folder" :size="16" /><span>工作目录</span></div>
          <div class="card">
            <div class="k">AxHub 目录</div>
            <div class="hint">当前加载的原型导出根目录</div>
            <div class="dirpath" :title="ws.rootDir">{{ ws.rootDir || '未选择目录' }}</div>
            <div class="acts">
              <a-button type="primary" ghost @click="chooseDir">
                <template #icon><svg-icon name="folder" :size="14" /></template>选择目录
              </a-button>
              <a-button v-if="ws.rootDir" danger ghost @click="removeDir">
                <template #icon><svg-icon name="trash" :size="14" /></template>移除目录
              </a-button>
            </div>
          </div>
          <div class="card">
            <div class="row">
              <div>
                <b>API 文档</b>
                <div class="hint">登记常用的 Apifox / Apipost 导出 .md 文件（可多个）。在 API 视图导入时可直接从这些文件挑选，无需每次翻找</div>
              </div>
              <a-button type="primary" ghost @click="addApiFiles">
                <template #icon><svg-icon name="plus" :size="14" /></template>添加文件
              </a-button>
            </div>
            <div v-if="api.files.length" class="dirlist">
              <div v-for="f in api.files" :key="f" class="diritem">
                <svg-icon name="file" :size="14" />
                <span class="diritem-p" :title="f">{{ baseName(f) }}</span>
                <button class="diritem-x" title="移除该文件" @click="rmApiFile(f)"><svg-icon name="x" :size="12" /></button>
              </div>
            </div>
            <div v-else class="hint">尚未登记文件</div>
          </div>
        </section>

        <!-- 外观 -->
        <section v-show="active === 'look'" class="set-sec">
          <div class="sec-h"><svg-icon name="palette" :size="16" /><span>外观</span></div>
          <div class="card">
            <div class="row">
              <div>
                <b>界面主题</b>
                <div class="hint">深色模式夜间看原型不刺眼；跟随系统随 OS 自动切换</div>
              </div>
              <a-radio-group :value="themeState.pref" size="small" @change="e => setTheme(e.target.value)">
                <a-radio-button value="auto">跟随系统</a-radio-button>
                <a-radio-button value="light">浅色</a-radio-button>
                <a-radio-button value="dark">深色</a-radio-button>
              </a-radio-group>
            </div>
            <div class="row">
              <div>
                <b>按模块分组</b>
                <div class="hint">按页面名编号前缀（00/01/...）分组</div>
              </div>
              <a-switch v-model:checked="st.group" />
            </div>
          </div>
        </section>

        <!-- 性能 -->
        <section v-show="active === 'perf'" class="set-sec">
          <div class="sec-h"><svg-icon name="bolt" :size="16" /><span>性能</span></div>
          <div class="card">
            <div class="lbl">同时保活预览数：<b>{{ st.maxAlive }}</b></div>
            <a-slider v-model:value="st.maxAlive" :min="2" :max="24" :marks="{ 2: '2', 8: '8', 16: '16', 24: '24' }" />
            <div class="hint">已加载页面常驻内存，切换零延迟。超量时最久未用的<b>未固定</b>标签释放（固定的不释放）。体积大就调小。</div>
          </div>
        </section>

        <!-- 行为与更新 -->
        <section v-show="active === 'behavior'" class="set-sec">
          <div class="sec-h"><svg-icon name="gear" :size="16" /><span>行为与更新</span></div>
          <div class="card">
            <div class="col">
              <div>
                <b>点击关闭按钮时</b>
                <div class="hint">选后台运行会最小化到系统托盘，可从托盘退出</div>
              </div>
              <a-radio-group v-model:value="st.closeAction" size="small" @change="saveClose">
                <a-radio-button value="">每次询问</a-radio-button>
                <a-radio-button value="background">后台运行</a-radio-button>
                <a-radio-button value="exit">直接退出</a-radio-button>
              </a-radio-group>
            </div>
            <div class="row">
              <div>
                <b>后台静默下载更新</b>
                <div class="hint">发现新版本后在后台自动下载安装包，不弹窗、不打断使用；下载完成后可立即重启，未操作则退出应用时自动安装</div>
              </div>
              <a-switch v-model:checked="st.silentUpdate" @change="saveSilent" />
            </div>
            <div class="row">
              <div>
                <b>版本与更新</b>
                <div class="hint">当前版本 v{{ appVersion }}<template v-if="lastCheck"> · 上次检查 {{ lastCheck }}</template></div>
              </div>
              <a-button :loading="checking" @click="checkUpdate">检查更新</a-button>
            </div>
          </div>
        </section>

        <!-- 关于 -->
        <section v-show="active === 'about'" class="set-sec">
          <div class="sec-h"><svg-icon name="info" :size="16" /><span>关于与帮助</span></div>
          <div class="card">
            <div>
              <b>快捷键</b>
              <div class="kb" style="margin-top:8px">
                <code>Ctrl/⌘+K</code> 搜索 · <code>Ctrl/⌘+D</code> 固定 · <code>Ctrl/⌘+R</code> 刷新 ·
                <code>Ctrl/⌘+B</code> 侧栏 · <code>Alt+W</code> 关标签 · <code>Alt+1~9</code> 跳标签 ·
                <code>Alt+←/→</code> 切换 · 标签双击固定 · 中键关闭
              </div>
              <div class="kb" style="margin-top:8px">
                API 视图下：<code>Ctrl/⌘+K</code> 搜索接口 · <code>Ctrl/⌘+B</code> 收起侧栏；标签类快捷键不生效
              </div>
            </div>
            <div class="divi"></div>
            <div>
              <b>技术栈 / 兼容性</b>
              <div class="kb" style="margin-top:8px">
                本工作台为<b>Electron 桌面端</b>：主进程内起零依赖本地服务（同源加载 AxHub 导出），
                渲染层为 <b>Vue 3 + Ant Design Vue</b>（Vite 构建产物）。<br><br>
                已兼容标准 AxHub/Axure 9 导出结构：<code>index.html</code> 为框架，顶级 <code>.html</code> 为各业务页面，
                <code>resources/ data/ images/ files/</code> 共享。iframe 同源加载，相对路径资源全部正常。
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import * as userData from '@/lib/user-data.js'
import { state as themeState, setTheme } from '@/lib/theme.js'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { host } from '@/host/index.js'
import { useWorkspaceStore, useSettingsStore, useApiStore, useUiStore } from '@/stores'
const ws = useWorkspaceStore()
const { settings } = useSettingsStore()
const apiStore = useApiStore()
const { ui } = useUiStore()
const { api } = apiStore

const st = settings

const appVersion = ref('…')
const checking = ref(false)
const lastCheck = ref('')

/* 设置分类导航 */
const active = ref('dir')
const cats = [
  { key: 'dir', name: '工作目录', icon: 'folder' },
  { key: 'look', name: '外观', icon: 'palette' },
  { key: 'perf', name: '性能', icon: 'bolt' },
  { key: 'behavior', name: '行为与更新', icon: 'gear' },
  { key: 'about', name: '关于与帮助', icon: 'info' }
]

onMounted(async () => {
  if (host.supports('appVersion')) appVersion.value = await host.appVersion()
})

async function checkUpdate () {
  if (!host.supports('lookForUpdate')) { message.warning('当前环境不支持在线更新'); return }
  checking.value = true
  try {
    const r = await host.lookForUpdate()
    lastCheck.value = new Date().toLocaleTimeString()
    if (!r || !r.ok) { message.error(r && r.error || '检查更新失败'); return }
    if (r.available) {
      message.info(r.portable
        ? `发现新版本 v${r.version}，便携版请到 Releases 页面重新下载`
        : st.silentUpdate ? `发现新版本 v${r.version}，已在后台开始下载` : `发现新版本 v${r.version}，请在弹窗中确认下载`)
    } else {
      message.success(`已是最新版本（v${appVersion.value}）`)
    }
  } finally {
    checking.value = false
  }
}

function chooseDir () { ws.selectDirectory() }

/* API 文档文件：多选添加（去重）/ 逐条移除 */
async function addApiFiles () {
  if (!host.supports('chooseDocuments')) { message.warning('当前环境不支持选择文件'); return }
  const paths = await host.chooseDocuments()
  if (!paths || !paths.length) return
  const n = apiStore.apiAddFiles(paths)
  message.info(n ? `已添加 ${n} 个文件` : '所选文件均已登记')
}
function rmApiFile (f) { apiStore.apiRemoveFile(f) }
function baseName (p) { const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')); return i >= 0 ? p.slice(i + 1) : p }

/* 移除当前关联的 AxHub 目录：清工作台记录 + 解绑目录（不删磁盘文件），重载回空态后弹添加引导 */
function removeDir () {
  const dir = ws.rootDir
  Modal.confirm({
    title: '移除 AxHub 目录',
    content: `解除与目录「${dir}」的关联，并清空本地页面列表、收藏、标签与标签页布局记录。\n\n磁盘上的 AxHub 文件不会被删除；之后每次打开应用都会提示重新添加目录。`,
    okText: '移除目录', okType: 'danger', cancelText: '取消',
    async onOk () {
      userData.clear() // 先清本地记录（同源缓存 + 宿主磁盘快照），再解绑目录并重载
      try {
        if (host.supports('releaseWorkspace')) { await host.releaseWorkspace(); return }
      } catch (e) { /* 宿主失败则退回页面重载 */ }
      location.reload()
    }
  })
}
function saveClose () {
  ws.persist()
  host.setPreferredExitAction(st.closeAction || '')
  message.info(st.closeAction === 'background' ? '以后点击关闭将最小化到托盘' : st.closeAction === 'exit' ? '以后点击关闭将直接退出' : '以后点击关闭会再次询问')
}
/* 后台静默下载开关：即时生效（主进程读同一份配置），并落盘 */
function saveSilent () {
  ws.persist()
  host.setBackgroundDownload(!!st.silentUpdate)
  message.info(st.silentUpdate ? '发现新版本将后台静默下载' : '发现新版本时会先询问是否下载')
}
function ok () {
  st.maxAlive = Math.max(2, Math.min(24, +st.maxAlive || 8))
  ws.persist()
  message.success('设置已保存')
}
</script>

<style scoped>
.set2{display:flex;min-height:440px;max-height:72vh}
.set-nav{flex:0 0 170px;display:flex;flex-direction:column;gap:2px;padding:12px 10px;border-right:1px solid var(--border-2);background:var(--panel-2);overflow:auto}
.cat{display:flex;align-items:center;gap:9px;padding:9px 11px;border:none;border-radius:8px;background:transparent;color:var(--text-2);font-size:13px;cursor:pointer;text-align:left;transition:background .1s,color .1s}
.cat:hover{background:var(--hover)}
.cat.on{background:var(--primary-soft);color:var(--primary-2);font-weight:600}
.cat.on :deep(svg){color:var(--primary)}
.set-body{flex:1 1 auto;overflow-y:auto;padding:18px 20px}
.set-sec{display:flex;flex-direction:column;gap:12px}
.sec-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:var(--text)}
.sec-h :deep(svg){color:var(--primary)}
.card{background:var(--panel);border:1px solid var(--border-2);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:12px}
.card .row{display:flex;align-items:center;justify-content:space-between;gap:14px}
.card .row b{font-size:13px;font-weight:600}
.card .col{display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.card .col b{font-size:13px;font-weight:600}
.divi{height:1px;background:var(--border-2);margin:-2px 0}
.dirlist{display:flex;flex-direction:column;gap:6px}
.diritem{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--border-2);border-radius:var(--r-sm,6px);background:var(--panel-2);font-size:12px}
.diritem :deep(svg){flex:0 0 auto;color:var(--muted)}
.diritem-p{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-2);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.diritem-x{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:none;border-radius:5px;background:transparent;color:var(--muted);cursor:pointer}
.diritem-x:hover{background:var(--hover);color:var(--danger)}
.k{font-size:13px;font-weight:600}
.lbl{font-size:12.5px;font-weight:600;color:var(--text-2);margin-bottom:8px}
.hint{font-size:11.5px;color:var(--muted);margin-top:4px;line-height:1.55}
.acts{display:flex;gap:8px;margin-top:4px;flex-wrap:wrap}
.dirpath{font-size:12px;color:var(--primary-2);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-top:2px}
.kb{font-size:12.5px;color:var(--text-2);line-height:1.8}
.kb code{font-size:11.5px;background:var(--panel-3);padding:1px 5px;border-radius:4px;color:var(--primary-2)}
</style>
