<template>
  <div class="tabbar">
    <div ref="tabsRef" class="tabs">
      <div v-if="!store.tabs.length" class="tabs-empty">从左侧选一个页面开始</div>
      <div v-for="t in store.tabs" :key="t.id" class="tab"
        :class="{ on: t.id === store.active, pinned: t.pinned, loading: t.loading }"
        :data-tab="t.id" :title="titleOf(t)"
        @click="setActive(t.id)"
        @dblclick="togglePin(t.id)"
        @mousedown.middle.prevent="closeTab(t.id)"
        @contextmenu.prevent="showTabMenu($event, t)">
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
    <div class="tabbar-act">
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
import { ref, watch, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import SvgIcon from './SvgIcon.vue'
import {
  store, persist, getP, activeTab, setActive, closeTab, togglePin,
  closeOthers, closeAllUnpinned, srcOf
} from '../store.js'
import { showCtx } from '../ctx.js'

const tabsRef = ref(null)
const titleOf = t => { const p = getP(t.pid); return (p && p.name) || t.title }

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

function reloadById (id) {
  const t = store.tabs.filter(x => x.id === id)[0]
  if (t) { t.rc = (t.rc || 0) + 1; t.loading = true }   // ViewerPane 以 :key 含 rc 重建 iframe
}
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
.tab:hover{background:#eef1f5}
.tab.on{background:var(--panel);box-shadow:inset 0 2px 0 var(--primary)}
.tab .tt{flex:1 1 auto;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-2)}
.tab.on .tt{color:var(--text);font-weight:600}
.tab.pinned{min-width:auto}
.tab .pin,.tab .cl{flex:0 0 auto;width:20px;height:20px;border-radius:5px;display:none;place-items:center;color:var(--muted);background:none;border:none;cursor:pointer}
.tab:hover .pin,.tab.on .pin,.tab.pinned .pin,.tab:hover .cl,.tab.on .cl{display:grid}
.tab .pin:hover{background:rgba(31,43,61,.1);color:var(--text)}
.tab .cl:hover{background:rgba(229,72,77,.14);color:var(--danger)}
.tab .st{flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:var(--muted);opacity:0}
.tab.loading .st{opacity:1;background:var(--warn);animation:pulse 1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.tabbar-act{flex:0 0 auto;display:flex;align-items:center;gap:2px;padding:0 6px;border-left:1px solid var(--border)}
.tabbar-act button{width:30px;height:30px;border-radius:6px;display:grid;place-items:center;color:var(--muted);background:none;border:none;cursor:pointer}
.tabbar-act button:hover{background:var(--panel-3);color:var(--text)}
</style>
