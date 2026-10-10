<template>
  <div class="agrp">
    <div class="ag-h" :class="{ closed, on: isGroupActive }" @click="toggle" @contextmenu.prevent="grpMenu($event)">
      <svg-icon name="chev" :size="12" class="chev" />
      <span class="ag-t" :title="title"><span v-html="hi(title, api.q)"></span></span>
      <span class="ag-cnt">{{ eps.length }}</span>
      <span class="ag-methods">
        <span v-for="c in methodDist" :key="c.k" class="mb mini" :class="c.k">{{ c.k[0] }}</span>
      </span>
    </div>
    <div v-if="!closed" class="ag-body">
      <ApiEpRow v-for="ep in eps" :key="ep.id" :ep="ep" :selected="ep.id === selId" @pick="pick(ep)" @menu="epMenu($event, ep)" />
      <div v-if="!eps.length" class="ag-none">该分组 {{ total }} 个接口均被筛选条件过滤</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { hi, copyText } from '@/components/api/api-shared'
import { useApiStore, useUiStore } from '@/stores'
const apiStore = useApiStore()
const { showCtx } = useUiStore()
const { api } = apiStore

const props = defineProps({
  modId: { type: String, required: true },
  title: { type: String, required: true },
  eps: { type: Array as PropType<any[]>, required: true },
  total: { type: Number, default: 0 },
  big: { type: Boolean, default: false } // 大模块：分组默认折叠
})

const key = computed(() => props.modId + '###' + props.title)
const closed = computed(() => {
  const explicit = api.closedGroups[key.value]
  return explicit !== undefined ? explicit : props.big
})
const selId = computed(() => api.sel && api.sel.epId)
const isGroupActive = computed(() =>
  api.sel && api.sel.moduleId === props.modId && props.eps.some(e => e.id === selId.value))

const methodDist = computed(() => {
  const used = {}
  props.eps.forEach(ep => { const k = ep.method || 'ANY'; used[k] = (used[k] || 0) + 1 })
  return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ANY'].filter(k => used[k]).map(k => ({ k, n: used[k] }))
})

function toggle () { apiStore.apiToggleGroup(props.modId, props.title) }
function pick (ep) { apiStore.apiSelect(props.modId, ep.id) }

function grpMenu (e) {
  showCtx(e.clientX, e.clientY, [
    { header: props.title || '默认分组' },
    { key: 'copy', label: '复制分组名', icon: 'copy', act: () => copyText(props.title) },
    { key: 'collapse', label: closed.value ? '展开分组' : '折叠分组', icon: 'chev', act: toggle }
  ])
}
function epMenu (e, ep) {
  showCtx(e.clientX, e.clientY, [
    { header: ep.name },
    { key: 'copyPath', label: '复制接口路径', icon: 'link', act: () => copyText(ep.path) },
    { key: 'copyName', label: '复制接口名', icon: 'copy', act: () => copyText(ep.name) }
  ])
}
</script>

<style scoped>
.agrp{min-width:0}
.ag-h{display:flex;align-items:center;gap:6px;padding:5px 6px 5px 14px;border-radius:var(--r-sm);cursor:pointer;user-select:none}
.ag-h:hover{background:var(--panel-3)}
.ag-h.on{background:var(--primary-soft)}
.ag-h .chev{transition:transform .15s;flex:0 0 auto;color:var(--muted)}
.ag-h.closed .chev{transform:rotate(-90deg)}
.ag-t{flex:1 1 auto;min-width:0;font-size:12.5px;font-weight:600;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ag-t mark{background:var(--mark-bg-2);color:var(--mark-text);border-radius:2px;padding:0 1px}
.ag-cnt{flex:0 0 auto;font-size:10.5px;color:var(--muted);background:var(--panel-3);padding:0 6px;border-radius:9px}
.ag-methods{flex:0 0 auto;display:flex;gap:2px}
.ag-methods .mb{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:4px;font-size:9px;font-weight:700;color:#fff}
.ag-methods .mb.mini{opacity:.85}
.ag-body{min-width:0}
.ag-none{padding:4px 8px 8px 24px;font-size:11.5px;color:var(--muted)}
</style>
