<template>
  <aside class="sidebar" :class="{ collapsed: store.settings.collapsed, dragging }" :style="{ '--sbw': sbw + 'px' }">
    <div class="sb-top">
      <a-input v-model:value="store.q" placeholder="搜索页面名 / 模块 (Ctrl+K)" allow-clear ref="qRef">
        <template #prefix><svg-icon name="search" :size="15" /></template>
      </a-input>
      <div class="sb-all">
        <button class="mini" title="展开所有分组" @click="expandAll"><svg-icon name="chev" :size="12" /><span>全部展开</span></button>
        <button class="mini" title="折叠所有分组" @click="collapseAll"><svg-icon name="chev" :size="12" class="up" /><span>全部折叠</span></button>
      </div>
      <div v-if="chips.length" class="tagbar">
        <button v-for="c in chips" :key="c.key" class="chip" :class="{ on: c.on }" @click="toggleFilter(c.key)">
          <svg-icon v-if="c.star" name="star" :size="11" fill />
          <span v-else class="dot" :style="{ background: c.color }" />
          <span>{{ c.label }}</span><span class="n">{{ c.n }}</span>
        </button>
        <button v-if="store.filterTags.length" class="chip clear" @click="store.filterTags = []">
          <svg-icon name="x" :size="11" /><span>清除</span>
        </button>
      </div>
    </div>

    <div ref="scrollRef" class="sb-scroll">
      <template v-if="!store.projects.length">
        <div class="empty"><svg-icon name="box" :size="28" /><b>目录为空</b>浏览器连上服务后会自动扫描</div>
      </template>
      <template v-else-if="!sections.length">
        <div class="empty"><svg-icon name="search" :size="28" /><b>没有匹配结果</b>换个关键词或清掉标签筛选</div>
      </template>
      <template v-else>
        <SectionNode v-for="sec in sections" :key="sec.key" :node="sec" />
      </template>
    </div>

    <!-- 拖拽调宽手柄：最宽 35% 窗口 / 最窄 100px，拖过最窄线直接收起 -->
    <div class="resizer" @mousedown="startResize" />
  </aside>
  <!-- 拖拽期间的全窗口透明遮罩：鼠标移到内容区 iframe 上方时事件不断流（否则拖拽会卡住/停住） -->
  <div v-if="dragging" class="resize-cover" @mousemove="dragMove" @mouseup="endResize"></div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import SvgIcon from './SvgIcon.vue'
import SectionNode from './SectionNode.vue'
import {
  store, persist, sidebarSections, collapseAll, expandAll, ancestorKeysOfPid
} from '../store.js'
import * as userData from '../user-data.js'

const sections = sidebarSections
const qRef = ref(null)
const scrollRef = ref(null)
// 宽度：初始沿用历史保存值（100 ~ 35% 窗口），之后支持拖拽调整
const SBW_MIN = 100
const SBW_RESTORE = 300            // logo 展开时恢复的固定宽度
const maxSbw = () => Math.floor(window.innerWidth * 0.35)
const sbw = ref(Math.max(SBW_MIN, Math.min(maxSbw(), userData.get('sbw', 300) || SBW_MIN)))

// 窗口变窄时若超出新的 35% 上限，自动收窄侧栏
function clampOnResize () {
  if (store.settings.collapsed) return
  if (sbw.value > maxSbw()) { sbw.value = Math.max(SBW_MIN, maxSbw()); userData.set('sbw', sbw.value) }
}

// 顶栏 logo（或 Ctrl+B）从收起态展开：恢复为固定宽度 300px（受 35% 上限约束）
function restoreSidebar () {
  sbw.value = Math.max(SBW_MIN, Math.min(maxSbw(), SBW_RESTORE))
  userData.set('sbw', sbw.value)
  store.settings.collapsed = false
  persist()
}

const chips = computed(() => {
  const used = {}
  store.projects.forEach(p => (p.tags || []).forEach(t => { used[t] = (used[t] || 0) + 1 }))
  const names = store.tags.map(t => t.name).filter(n => used[n])
  Object.keys(used).forEach(n => { if (names.indexOf(n) < 0) names.push(n) })
  const out = []
  const favN = store.projects.filter(p => p.fav).length
  if (favN) out.push({ key: '__fav', label: '收藏', n: favN, star: true, on: store.filterTags.indexOf('__fav') >= 0 })
  names.forEach(n => out.push({ key: n, label: n, n: used[n], color: store.tags.find(t => t.name === n)?.color || '#1296db', on: store.filterTags.indexOf(n) >= 0 }))
  return out
})
function toggleFilter (key) {
  const i = store.filterTags.indexOf(key)
  if (i >= 0) store.filterTags.splice(i, 1)
  else store.filterTags.push(key)
}

function focusSearch () { if (qRef.value) qRef.value.focus() }
onMounted(() => {
  window.addEventListener('ax-focus-search', focusSearch)
  window.addEventListener('resize', clampOnResize)
  window.addEventListener('ax-restore-sidebar', restoreSidebar)
  window.addEventListener('mouseup', endResize)   // 遮罩外的兜底结束（窗口外松键等）
  window.addEventListener('blur', endResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('ax-focus-search', focusSearch)
  window.removeEventListener('resize', clampOnResize)
  window.removeEventListener('ax-restore-sidebar', restoreSidebar)
  window.removeEventListener('mouseup', endResize)
  window.removeEventListener('blur', endResize)
})

/* ---------- 侧栏宽度拖拽 ----------
 * 卡顿处理：
 *  1) 拖拽时 .sidebar 挂 .dragging → 关闭 0.2s 宽度过渡，宽度 1:1 跟手
 *     （原来每个 mousemove 都在追动画，看着发飘、明显延迟）
 *  2) 拖拽时挂全窗口遮罩 .resize-cover（z-index 高于内容 iframe），
 *     避免鼠标移进 iframe 后 mousemove 断流导致拖到一半卡住
 * 约束：最宽 = 当前窗口 35%；最窄 = 100px；拖到 100px 以内直接收起 */
const dragging = ref(false)

function startResize (e) {
  e.preventDefault()
  dragging.value = true
}

function dragMove (ev) {
  if (ev.clientX < SBW_MIN) {   // 拖过最窄线 → 立即收起（结束拖拽后收起动画照常播放）
    store.settings.collapsed = true
    persist()
    endResize()
    return
  }
  sbw.value = Math.min(maxSbw(), ev.clientX)
}

function endResize () {
  if (!dragging.value) return
  dragging.value = false
  userData.set('sbw', sbw.value) // 经持久化 module 落盘（旧版直写 localStorage 从不落盘，重启即丢）
}

/* 需求3：激活 tab 后，自动展开其所在分组（含所有祖先）并滚动定位 */
watch(() => store.active, () => {
  const t = store.tabs.filter(x => x.id === store.active)[0]
  if (!t) return
  const keys = ancestorKeysOfPid(sidebarSections.value, t.pid)
  let changed = false
  keys.forEach(k => { if (store.secClosed[k]) { store.secClosed[k] = false; changed = true } })
  if (changed) persist()
  nextTick(() => {
    requestAnimationFrame(() => {
      if (!scrollRef.value) return
      const el = scrollRef.value.querySelector(`.item[data-p="${t.pid}"]`)
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' })
    })
  })
})
</script>

<style scoped>
.sidebar{flex:0 0 var(--sbw);width:var(--sbw);min-width:0;background:var(--panel);border-right:1px solid var(--border);display:flex;flex-direction:column;min-height:0;position:relative;z-index:30;transition:flex-basis .2s ease,width .2s ease}
.sidebar.dragging{transition:none}   /* 拖拽中关闭过渡：宽度 1:1 跟手，避免追动画的延迟 */
.sidebar.collapsed{flex-basis:0;width:0;border-right-width:0;overflow:hidden}
.resizer{position:absolute;top:0;right:-3px;width:6px;height:100%;cursor:col-resize;z-index:35}
.sidebar.collapsed .resizer{display:none}
.resizer:hover::after{content:'';position:absolute;left:2px;top:0;width:2px;height:100%;background:var(--primary)}
.sidebar.dragging .resizer::after{content:'';position:absolute;left:2px;top:0;width:2px;height:100%;background:var(--primary)}
/* 拖拽遮罩：fixed 铺满窗口、z-index 高于 iframe，保证 mousemove/mouseup 全程落在主文档 */
.resize-cover{position:fixed;inset:0;z-index:9998;cursor:col-resize;user-select:none;touch-action:none}
.sb-top{padding:10px 10px 8px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--border-2)}
.sb-all{display:flex;gap:6px}
.sb-all .mini{display:inline-flex;align-items:center;gap:4px;flex:1 1 0;justify-content:center;height:28px;padding:0 8px;border-radius:6px;font-size:12px;color:var(--text-2);background:var(--panel-3);border:1px solid var(--border-2);cursor:pointer;transition:background .1s,color .1s}
.sb-all .mini:hover{background:#e8ecf1;color:var(--primary)}
.sb-all .mini .up{transform:rotate(180deg)}
.tagbar{display:flex;flex-wrap:wrap;gap:5px;max-height:88px;overflow:auto}
.chip{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:20px;font-size:12px;background:var(--panel-3);color:var(--text-2);border:1px solid transparent;cursor:pointer}
.chip:hover{background:#e8ecf1}
.chip.on{background:var(--primary-soft);color:var(--primary-2);border-color:var(--primary-soft-2);font-weight:600}
.chip .dot{width:7px;height:7px;border-radius:50%;flex:0 0 auto}
.chip .n{color:var(--muted);font-size:11px}
.chip.on .n{color:var(--primary-2)}
.chip.clear{color:var(--danger)}
.sb-scroll{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;padding:6px 8px 20px}
.empty{padding:26px 16px;text-align:center;color:var(--muted);font-size:13px;line-height:1.7}
.empty svg{color:#c3ccd7;margin-bottom:8px}
.empty b{color:var(--text-2);display:block;margin-bottom:4px;font-size:13.5px}
</style>
