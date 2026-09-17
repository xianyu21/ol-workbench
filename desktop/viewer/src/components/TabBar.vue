<template>
  <div class="tabbar">
    <!-- 溢出滚动箭头：tabs 超宽时两端渐显 -->
    <button v-if="ovf.l" class="ovf l" title="向左滚动" @click="scrollTabs(-1)">
      <svg-icon name="chev" :size="13" class="flip" />
    </button>
    <div ref="tabsRef" class="tabs" @wheel.prevent="onWheel" @scroll="updateOvf">
      <div v-if="!store.tabs.length" class="tabs-empty">从左侧选一个页面开始</div>
      <div v-for="t in store.tabs" :key="t.id" class="tab"
        :class="{ on: t.id === store.active, pinned: t.pinned, loading: t.loading,
                  dragging: dragId === t.id, 'drop-l': overId === t.id && dropSide === 'l', 'drop-r': overId === t.id && dropSide === 'r' }"
        :data-tab="t.id" :title="titleOf(t)" draggable="true"
        @click="setActive(t.id)"
        @dblclick="togglePin(t.id)"
        @mousedown.middle.prevent="closeTab(t.id)"
        @contextmenu.prevent="showTabMenu($event, t)"
        @dragstart="onDragStart($event, t)"
        @dragend="onDragEnd"
        @dragover.prevent="onDragOver(t)"
        @drop.prevent="onDrop(t)">
        <span class="st" />
        <span class="tt">{{ titleOf(t) }}</span>
        <button class="pin" :title="t.pinned ? '取消固定' : '固定此标签'" @click.stop="togglePin(t.id)">
          <svg-icon name="pin" :size="13" :fill="!!t.pinned" />
        </button>
        <button class="cl" title="关闭" @click.stop="closeTab(t.id)">
          <svg-icon name="x" :size="13" />
        </button>
      </div>
    </div>
    <button v-if="ovf.r" class="ovf r" title="向右滚动" @click="scrollTabs(1)">
      <svg-icon name="chev" :size="13" />
    </button>
    <div class="tabbar-act">
      <!-- 全部标签下拉：溢出不可见时从这里直达任意标签 -->
      <a-dropdown trigger="click">
        <a-tooltip title="全部标签" :mouseEnterDelay="0.4">
          <button class="alltabs"><svg-icon name="chev" :size="14" class="down" /></button>
        </a-tooltip>
        <template #overlay>
          <a-menu class="ax-tab-menu" :selected-keys="[store.active]" @click="({ key }) => setActive(key)">
            <a-menu-item v-for="t in store.tabs" :key="t.id">
              <svg-icon v-if="t.pinned" name="pin" :size="11" fill class="tm-pin" />
              <span class="tm-t">{{ titleOf(t) }}</span>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
      <a-tooltip title="刷新当前预览 (Ctrl+R)">
        <button @click="reloadActive"><svg-icon name="refresh" :size="15" /></button>
      </a-tooltip>
      <a-tooltip title="固定/取消固定当前标签 (Ctrl+D)">
        <button @click="pinActive"><svg-icon name="pin" :size="15" /></button>
      </a-tooltip>
      <a-tooltip title="在新窗口打开">
        <button @click="openActiveExternal"><svg-icon name="ext" :size="15" /></button>
      </a-tooltip>
      <a-tooltip title="关闭其他未固定标签">
        <button @click="closeOthersAct"><svg-icon name="layers" :size="15" /></button>
      </a-tooltip>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import SvgIcon from './SvgIcon.vue'
import {
  store, getP, activeTab, setActive, closeTab, togglePin, reloadTab,
  closeOthers, closeAllUnpinned, srcOf, reorderTab
} from '../store.js'
import { showCtx } from '../ctx.js'

const tabsRef = ref(null)
const titleOf = t => { const p = getP(t.pid); return (p && p.name) || t.title }

/* ---------- 溢出箭头 + 滚轮横滚 ---------- */
const ovf = ref({ l: false, r: false })

function updateOvf () {
  const el = tabsRef.value
  if (!el) { ovf.value = { l: false, r: false }; return }
  ovf.value = {
    l: el.scrollLeft > 1,
    r: el.scrollLeft < el.scrollWidth - el.clientWidth - 1
  }
}
function scrollTabs (dir) {
  const el = tabsRef.value
  if (el) el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.6), behavior: 'smooth' })
}
function onWheel (e) {
  const el = tabsRef.value
  if (!el) return
  // 触控板横向手势直接用 deltaX；鼠标滚轮把 deltaY 转成横滚
  el.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
}

let ro = null
onMounted(() => {
  updateOvf()
  // 容器宽度变化（侧栏拖宽/收起、窗口缩放）后重算溢出态
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(updateOvf)
    if (tabsRef.value) ro.observe(tabsRef.value)
  }
  window.addEventListener('resize', updateOvf)
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  window.removeEventListener('resize', updateOvf)
})
watch(() => store.tabs.length, () => nextTick(updateOvf))

/* ---------- 拖拽排序（固定组与未固定组不混排，跨组拖拽在 store.reorderTab 内忽略） ---------- */
const dragId = ref(null)
const overId = ref(null)

/* 插入位置指示：源在目标左侧 → 落点在目标之后（右缘线），反之在前（左缘线） */
const dropSide = computed(() => {
  if (!dragId.value || !overId.value) return ''
  const a = store.tabs.findIndex(x => x.id === dragId.value)
  const b = store.tabs.findIndex(x => x.id === overId.value)
  return a < b ? 'r' : 'l'
})

function onDragStart (e, t) {
  dragId.value = t.id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', t.id) // Firefox 需要 setData 才触发 drag
}
function onDragOver (t) {
  overId.value = (!dragId.value || dragId.value === t.id) ? null : t.id
}
function onDrop (t) {
  if (dragId.value && dragId.value !== t.id) reorderTab(dragId.value, t.id)
  onDragEnd()
}
function onDragEnd () {
  dragId.value = null
  overId.value = null
}

/* ---------- 标签菜单 / 动作 ---------- */
function showTabMenu (e, t) {
  const p = getP(t.pid)
  showCtx(e.clientX, e.clientY, [
    { header: p ? p.name : t.title },
    { label: t.pinned ? '取消固定' : '固定标签页', icon: 'pin', act: () => togglePin(t.id) },
    { label: '刷新此标签', icon: 'refresh', act: () => { setActive(t.id); setTimeout(() => reloadById(t.id), 30) } },
    { label: '在新窗口打开', icon: 'ext', act: () => { if (p) window.open(srcOf(p), '_blank') } },
    { divider: true },
    { label: '关闭标签页', icon: 'x', act: () => closeTab(t.id) },
    { label: '关闭其他未固定', icon: 'layers', act: () => closeOthers(t.id) },
    { label: '关闭全部未固定', icon: 'trash', danger: true, act: () => closeAllUnpinned() }
  ])
}

function reloadById (id) { reloadTab(id) } // ViewerPane 以 :key 含 rc 重建 iframe，按当前 pid 重新加载
function reloadActive () {
  const t = activeTab.value
  if (!t) { message.warning('没有打开的标签'); return }
  reloadById(t.id)
  message.success('已刷新', 1.4)
}
function pinActive () {
  const t = activeTab.value
  if (t) togglePin(t.id); else message.warning('没有打开的标签')
}
function openActiveExternal () {
  const t = activeTab.value
  const p = t ? getP(t.pid) : null
  if (!p) { message.warning('没有可打开的页面'); return }
  const w = window.open(srcOf(p), '_blank')
  if (!w) message.error('浏览器拦截了新窗口')
}
function closeOthersAct () {
  const t = activeTab.value
  const n = store.tabs.filter(x => !x.pinned && (!t || x.id !== t.id)).length
  if (!n) { message.warning('没有可关闭的未固定标签'); return }
  closeOthers(t ? t.id : null)
  message.success('已关闭 ' + n + ' 个')
}
window.addEventListener('ax-reload-active', reloadActive)

/* 激活 tab 滚动到可见（tab 栏内） */
watch(() => store.active, () => {
  nextTick(() => {
    if (!tabsRef.value) return
    const el = tabsRef.value.querySelector('.tab.on')
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
})
</script>

<style scoped>
.tabbar{flex:0 0 auto;height:40px;display:flex;align-items:stretch;background:var(--panel-2);border-bottom:1px solid var(--border);position:relative;z-index:20}
.tabs{flex:1 1 auto;display:flex;align-items:stretch;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
.tabs::-webkit-scrollbar{height:0}
.tabs-empty{display:flex;align-items:center;padding:0 13px;font-size:12.5px;color:var(--muted)}
.tab{flex:0 0 auto;display:flex;align-items:center;gap:6px;max-width:220px;min-width:96px;padding:0 8px 0 11px;border-right:1px solid var(--border);background:var(--panel-2);cursor:pointer;position:relative;transition:background .1s;user-select:none}
.tab:hover{background:var(--hover-2)}
.tab.on{background:var(--panel);box-shadow:inset 0 2px 0 var(--primary)}
.tab .tt{flex:1 1 auto;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-2)}
.tab.on .tt{color:var(--text);font-weight:600}
.tab.pinned{min-width:auto}
.tab .pin,.tab .cl{flex:0 0 auto;width:20px;height:20px;border-radius:5px;display:none;place-items:center;color:var(--muted);background:none;border:none;cursor:pointer}
.tab:hover .pin,.tab.on .pin,.tab.pinned .pin,.tab:hover .cl,.tab.on .cl{display:grid}
.tab .pin:hover{background:var(--btn-soft);color:var(--text)}
.tab .cl:hover{background:rgba(229,72,77,.14);color:var(--danger)}
.tab .st{flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:var(--muted);opacity:0}
.tab.loading .st{opacity:1;background:var(--warn);animation:pulse 1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
/* 拖拽排序视觉：源半透明，落点目标边缘画蓝色插入线 */
.tab.dragging{opacity:.4}
.tab.drop-l{box-shadow:inset 2px 0 0 var(--primary)}
.tab.drop-r{box-shadow:inset -2px 0 0 var(--primary)}
.tab.drop-l.on{box-shadow:inset 0 2px 0 var(--primary),inset 2px 0 0 var(--primary)}
.tab.drop-r.on{box-shadow:inset 0 2px 0 var(--primary),inset -2px 0 0 var(--primary)}
/* 溢出滚动箭头：压在 tabs 两端 */
.ovf{flex:0 0 auto;width:22px;border:none;cursor:pointer;display:grid;place-items:center;color:var(--muted);background:var(--panel-2);position:relative;z-index:2;padding:0}
.ovf.l{margin-right:-1px;box-shadow:1px 0 4px rgba(0,0,0,.06)}
.ovf.r{margin-left:-1px;box-shadow:-1px 0 4px rgba(0,0,0,.06)}
.ovf:hover{color:var(--primary);background:var(--hover-2)}
.ovf .flip{transform:rotate(180deg)}
.tabbar-act{flex:0 0 auto;display:flex;align-items:center;gap:2px;padding:0 6px;border-left:1px solid var(--border)}
.tabbar-act button{width:30px;height:30px;border-radius:6px;display:grid;place-items:center;color:var(--muted);background:none;border:none;cursor:pointer}
.tabbar-act button:hover{background:var(--panel-3);color:var(--text)}
.tabbar-act .down{transform:rotate(90deg)}
</style>

<style>
/* 全部标签下拉：overlay 挂在 body 下，需全局样式 */
.ax-tab-menu{max-height:420px;overflow:auto;min-width:180px}
.ax-tab-menu .tm-t{font-size:12.5px}
.ax-tab-menu .tm-pin{color:var(--primary);margin-right:4px}
.ax-tab-menu .ant-dropdown-menu-item-selected{font-weight:600}
</style>
