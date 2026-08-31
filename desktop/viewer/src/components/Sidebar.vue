<template>
  <aside class="sidebar" :class="{ collapsed: store.settings.collapsed }" :style="{ '--sbw': sbw + 'px' }">
    <div class="sb-top">
      <a-input v-model:value="store.q" placeholder="搜索页面名 / 模块 (Ctrl+K)" allow-clear ref="qRef">
        <template #prefix><svg-icon name="search" :size="15" /></template>
      </a-input>
      <div class="sb-row">
        <div class="seg">
          <button class="on" title="列表视图"><svg-icon name="list" :size="14" /></button>
        </div>
        <a-select v-model:value="store.settings.sort" class="sort-sel" size="small" @change="persist">
          <a-select-option value="name">名称 A-Z</a-select-option>
          <a-select-option value="recent">最近打开</a-select-option>
          <a-select-option value="hot">打开次数</a-select-option>
          <a-select-option value="added">扫描顺序</a-select-option>
          <a-select-option value="size">文件体积</a-select-option>
        </a-select>
      </div>
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

    <div class="resizer" @mousedown="startResize" />
    <button class="sb-toggle" title="收起 / 展开侧栏 (Ctrl+B)"
      @click="store.settings.collapsed = !store.settings.collapsed; persist()">
      <svg-icon :name="store.settings.collapsed ? 'chevR' : 'chevL'" :size="15" />
    </button>
  </aside>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import SvgIcon from './SvgIcon.vue'
import SectionNode from './SectionNode.vue'
import {
  store, persist, sidebarSections, collapseAll, expandAll, ancestorKeysOfPid
} from '../store.js'

const sections = sidebarSections
const qRef = ref(null)
const scrollRef = ref(null)
const sbw = ref(parseSbw())

function parseSbw () {
  try { const v = JSON.parse(localStorage.getItem('wb_axhub_sbw')); if (typeof v === 'number') return v } catch (e) {}
  return 300
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
onMounted(() => window.addEventListener('ax-focus-search', focusSearch))
onBeforeUnmount(() => window.removeEventListener('ax-focus-search', focusSearch))

/* ---------- 侧栏宽度拖拽 ---------- */
function startResize (e) {
  e.preventDefault()
  const move = ev => { sbw.value = Math.max(210, Math.min(560, ev.clientX)) }
  const up = () => {
    try { localStorage.setItem('wb_axhub_sbw', JSON.stringify(sbw.value)) } catch (err) {}
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
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
.sidebar.collapsed{flex-basis:0;width:0;border-right-width:0;overflow:hidden}
.sidebar.collapsed .resizer,.sidebar.collapsed .sb-toggle{display:none}
.sb-top{padding:10px 10px 8px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--border-2)}
.sb-row{display:flex;align-items:center;gap:6px}
.seg{display:flex;background:var(--panel-3);border-radius:var(--r-sm);padding:2px;gap:2px}
.seg button{height:28px;padding:0 9px;border-radius:5px;font-size:12px;color:var(--text-2);display:inline-flex;align-items:center;gap:5px;cursor:default}
.seg button.on{background:#fff;color:var(--primary);box-shadow:var(--sh-1)}
.sort-sel{flex:1 1 auto;min-width:0}
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
.resizer{position:absolute;top:0;right:-3px;width:6px;height:100%;cursor:col-resize;z-index:35}
.resizer:hover::after{content:'';position:absolute;left:2px;top:0;width:2px;height:100%;background:var(--primary)}
.sb-toggle{position:absolute;top:9px;left:var(--sbw);transform:translateX(-50%);z-index:50;width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:var(--panel);color:var(--text-2);display:grid;place-items:center;cursor:pointer;box-shadow:var(--sh-1);transition:left .2s ease}
.sb-toggle:hover{background:var(--panel-3);color:var(--primary)}
</style>
