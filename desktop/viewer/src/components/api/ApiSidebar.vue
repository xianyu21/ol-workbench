<template>
  <aside class="api-sidebar" :class="{ collapsed: settings.collapsed, dragging }" :style="{ '--sbw': sbw + 'px' }">
    <div class="sb-top">
      <div class="sb-row">
        <a-input v-model:value="api.q" placeholder="搜索接口 (Ctrl+K)" allow-clear ref="qRef" class="sb-search">
          <template #prefix><svg-icon name="search" :size="15" /></template>
        </a-input>
        <div class="sb-all">
          <a-tooltip title="导入 Markdown（Apifox / Apipost 导出）">
            <button class="mini" @click="ui.importMd = {}"><svg-icon name="ul" :size="13" /></button>
          </a-tooltip>
          <a-tooltip title="新建业务模块">
            <button class="mini" @click="newModule"><svg-icon name="plus" :size="13" /></button>
          </a-tooltip>
        </div>
      </div>
      <div v-if="chips.length" class="tagbar">
        <button v-for="c in chips" :key="c.key" class="chip mchip" :class="{ on: c.on }" @click="toggleMethod(c.key)">
          <span class="mb" :class="c.key">{{ c.key }}</span><span class="n">{{ c.n }}</span>
        </button>
        <button v-if="api.methods.length" class="chip clear" @click="api.methods = []">
          <svg-icon name="x" :size="11" /><span>清除</span>
        </button>
      </div>
    </div>

    <div class="api-tree-scroll">
      <div v-if="!modCount" class="empty">
        <svg-icon name="code" :size="28" />
        <b>还没有接口模块</b>
        <div>导入 Apifox / Apipost 导出的 Markdown，每个文件即一个业务模块</div>
        <div class="ep-act">
          <a-button size="small" type="primary" @click="ui.importMd = {}">
            <template #icon><svg-icon name="ul" :size="13" /></template>导入 Markdown
          </a-button>
          <a-button size="small" @click="newModule">新建模块</a-button>
        </div>
      </div>
      <div v-else-if="!tree.length" class="empty">
        <svg-icon name="search" :size="28" /><b>没有匹配接口</b>换个关键词或清掉方法筛选
      </div>
      <template v-else>
        <ApiModuleNode v-for="m in tree" :key="m.mod.id" :node="m" />
      </template>
    </div>

    <div class="resizer" @mousedown="startResize" />
  </aside>
  <!-- 拖拽期间的全窗口遮罩：避免鼠标移到 iframe 上方时 mousemove 断流 -->
  <div v-if="dragging" class="resize-cover" @mousemove="dragMove" @mouseup="endResize"></div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import * as userData from '@/lib/user-data.js'
import { useWorkspaceStore, useApiStore, useSettingsStore, useUiStore } from '@/stores'
const ws = useWorkspaceStore()
const apiStore = useApiStore()
const { settings } = useSettingsStore()
const { ui } = useUiStore()
const { api } = apiStore

const tree = computed(() => apiStore.apiTree)
const modCount = computed(() => (apiStore.apiModules || []).length)
const qRef = ref(null)

/* 与原型侧栏共用同一套宽度（sbw）与收起语义，切换视图时不跳变 */
const SBW_MIN = 100
const SBW_RESTORE = 300
const maxSbw = () => Math.floor(window.innerWidth * 0.35)
const sbw = ref(Math.max(SBW_MIN, Math.min(maxSbw(), userData.get('sbw', 300) || SBW_MIN)))
function clampOnResize () {
  if (settings.collapsed) return
  if (sbw.value > maxSbw()) { sbw.value = Math.max(SBW_MIN, maxSbw()); userData.set('sbw', sbw.value) }
}
function restoreSidebar () {
  sbw.value = Math.max(SBW_MIN, Math.min(maxSbw(), SBW_RESTORE))
  userData.set('sbw', sbw.value)
  settings.collapsed = false
  ws.persist()
}

/* 方法筛选 chips */
const chips = computed(() => {
  const used = {}
  apiStore.apiModules.forEach(m => m.endpoints.forEach(ep => {
    const k = ep.method || 'ANY'
    used[k] = (used[k] || 0) + 1
  }))
  return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ANY']
    .filter(k => used[k])
    .map(k => ({ key: k, n: used[k], on: api.methods.indexOf(k) >= 0 }))
})
function toggleMethod (k) {
  const i = api.methods.indexOf(k)
  if (i >= 0) api.methods.splice(i, 1)
  else api.methods.push(k)
}

function newModule () { ui.apiModule = { mode: 'create', id: null } }
function focusSearch () { if (qRef.value) qRef.value.focus() }

onMounted(() => {
  window.addEventListener('ax-focus-api-search', focusSearch)
  window.addEventListener('resize', clampOnResize)
  window.addEventListener('ax-restore-sidebar', restoreSidebar)
  window.addEventListener('mouseup', endResize)
  window.addEventListener('blur', endResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('ax-focus-api-search', focusSearch)
  window.removeEventListener('resize', clampOnResize)
  window.removeEventListener('ax-restore-sidebar', restoreSidebar)
  window.removeEventListener('mouseup', endResize)
  window.removeEventListener('blur', endResize)
})

/* 拖拽调宽：与原型侧栏同款约束（最宽 35% 窗口 / 最窄 100px，过窄直接收起） */
const dragging = ref(false)
function startResize (e) { e.preventDefault(); dragging.value = true }
function dragMove (ev) {
  if (ev.clientX < SBW_MIN) { settings.collapsed = true; ws.persist(); endResize(); return }
  sbw.value = Math.min(maxSbw(), ev.clientX)
}
function endResize () {
  if (!dragging.value) return
  dragging.value = false
  userData.set('sbw', sbw.value)
}
</script>

<style scoped>
.api-sidebar{flex:0 0 var(--sbw);width:var(--sbw);min-width:0;background:var(--panel);border-right:1px solid var(--border);display:flex;flex-direction:column;min-height:0;position:relative;z-index:30;transition:flex-basis .2s ease,width .2s ease}
.api-sidebar.dragging{transition:none}
.api-sidebar.collapsed{flex-basis:0;width:0;border-right-width:0;overflow:hidden}
.resizer{position:absolute;top:0;right:-3px;width:6px;height:100%;cursor:col-resize;z-index:35}
.api-sidebar.collapsed .resizer{display:none}
.resizer:hover::after{content:'';position:absolute;left:2px;top:0;width:2px;height:100%;background:var(--primary)}
.api-sidebar.dragging .resizer::after{content:'';position:absolute;left:2px;top:0;width:2px;height:100%;background:var(--primary)}
.resize-cover{position:fixed;inset:0;z-index:9998;cursor:col-resize;user-select:none}
.sb-top{padding:10px 10px 8px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--border-2)}
.sb-row{display:flex;align-items:center;gap:6px}
.sb-search{flex:1 1 auto;min-width:0}
.sb-all{flex:0 0 auto;display:flex;gap:4px}
.sb-all .mini{display:inline-flex;align-items:center;justify-content:center;height:28px;width:28px;padding:0;border-radius:6px;color:var(--text-2);background:var(--panel-3);border:1px solid var(--border-2);cursor:pointer;transition:background .1s,color .1s}
.sb-all .mini:hover{background:var(--hover);color:var(--primary)}
.tagbar{display:flex;flex-wrap:wrap;gap:5px;max-height:88px;overflow:auto}
.chip{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border-radius:20px;font-size:12px;background:var(--panel-3);color:var(--text-2);border:1px solid transparent;cursor:pointer}
.chip:hover{background:var(--hover)}
.chip.on{background:var(--primary-soft);border-color:var(--primary-soft-2);font-weight:600}
.chip .mb{padding:0 5px;line-height:15px}
.chip .n{color:var(--muted);font-size:11px}
.chip.clear{color:var(--danger)}
.api-tree-scroll{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;padding:0 8px 20px}
.empty{padding:26px 16px;text-align:center;color:var(--muted);font-size:13px;line-height:1.7}
.empty svg{color:var(--empty-ico);margin-bottom:8px}
.empty b{color:var(--text-2);display:block;margin-bottom:4px;font-size:13.5px}
.ep-act{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}
</style>
