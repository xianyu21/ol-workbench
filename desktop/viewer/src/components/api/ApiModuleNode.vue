<template>
  <div class="amod">
    <div class="am-h" :class="{ closed, on: isModActive }" @click="toggle" @contextmenu.prevent="modMenu($event)">
      <svg-icon name="chev" :size="13" class="chev" />
      <svg-icon name="file" :size="13" />
      <span class="am-t" :title="node.mod.fileName || node.mod.name"><span v-html="hi(node.mod.name, api.q)"></span></span>
      <span class="cnt" :class="{ f: filtering }" :title="countTitle">{{ displayCount }}</span>
      <div class="am-tools">
        <button v-if="!singleGroup" class="am-act" :title="allGroupsClosed ? '展开全部分组' : '折叠全部分组'" @click.stop="toggleGroups">
          <svg-icon :name="allGroupsClosed ? 'chevR' : 'chevL'" :size="12" />
        </button>
      </div>
    </div>
    <div v-if="!closed" class="am-body">
      <template v-if="singleGroup">
        <ApiEpRow v-for="ep in node.groups[0].endpoints" :key="ep.id" :ep="ep"
          :selected="ep.id === selId" @pick="pick(ep)" @menu="epMenu($event, ep)" />
      </template>
      <template v-else>
        <ApiGroupNode v-for="g in node.groups" :key="g.title" :mod-id="node.mod.id" :title="g.title"
          :eps="g.endpoints" :total="node.total" :big="node.total > 40" />
      </template>
      <div v-if="!node.matchCount" class="am-none">该模块共 {{ node.total }} 个接口，均被筛选条件过滤</div>
      <div v-if="node.doc.warnings.length" class="am-warn">
        <svg-icon name="warn" :size="12" /><span>{{ node.doc.warnings[0] }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { hi, copyText } from '@/components/api/api-shared.js'
import { useApiStore, useUiStore } from '@/stores'
const apiStore = useApiStore()
const { ui, showCtx } = useUiStore()
const { api } = apiStore

const props = defineProps({ node: { type: Object, required: true } })

const closed = computed(() => !!api.closed[props.node.mod.id])
const selId = computed(() => api.sel && api.sel.epId)
const isModActive = computed(() => api.sel && api.sel.moduleId === props.node.mod.id)
const singleGroup = computed(() => props.node.groups.length === 1 && props.node.groups[0].title === '')

/* 模块行接口数量统计：默认显示总数；启用搜索/方法筛选时显示匹配数（hover 见总数） */
const filtering = computed(() => !!(String(api.q || '').trim() || (api.methods || []).length))
const displayCount = computed(() => filtering.value ? props.node.matchCount : props.node.total)
const countTitle = computed(() => filtering.value
  ? `匹配 ${props.node.matchCount} / 共 ${props.node.total} 个接口`
  : `共 ${props.node.total} 个接口`)

const allGroupsClosed = computed(() => {
  if (singleGroup.value) return false
  const big = props.node.total > 40
  return props.node.groups.every(g => {
    const explicit = api.closedGroups[props.node.mod.id + '###' + g.title]
    return explicit !== undefined ? explicit : big
  })
})
function toggleGroups () { apiStore.apiSetGroups(props.node.mod.id, props.node.groups.map(g => g.title), !allGroupsClosed.value) }

function toggle () { apiStore.apiToggleModule(props.node.mod.id) }
function pick (ep) { apiStore.apiSelect(props.node.mod.id, ep.id) }

function modMenu (e) {
  const m = props.node.mod
  showCtx(e.clientX, e.clientY, [
    { header: m.name },
    { key: 'rename', label: '重命名模块', icon: 'edit', act: () => { ui.apiModule = { mode: 'rename', id: m.id } } },
    { key: 'reimport', label: '重新导入覆盖', icon: 'refresh', act: () => { ui.importMd = { id: m.id, replace: true } } },
    { key: 'copy', label: '复制模块名', icon: 'copy', act: () => copyText(m.name) },
    { divider: true },
    { key: 'del', label: '删除模块', icon: 'trash', danger: true, act: confirmRemove }
  ])
}

function epMenu (e, ep) {
  showCtx(e.clientX, e.clientY, [
    { header: ep.name },
    { key: 'copyPath', label: '复制接口路径', icon: 'link', act: () => copyText(ep.path) },
    { key: 'copyName', label: '复制接口名', icon: 'copy', act: () => copyText(ep.name) }
  ])
}

function confirmRemove () {
  const m = props.node.mod
  Modal.confirm({
    title: '删除业务模块',
    content: `删除「${m.name}」及其 ${props.node.total} 个接口。只删除工作台内的记录，不会改动磁盘上的 Markdown 文件。`,
    okText: '删除', okType: 'danger', cancelText: '取消',
    onOk () {
      apiStore.apiRemoveModule(m.id)
      message.success('已删除模块')
    }
  })
}
</script>

<style scoped>
.amod{min-width:0;margin-bottom:2px}
.am-h{display:flex;align-items:center;gap:6px;padding:7px 6px;border-radius:var(--r-sm);cursor:pointer;user-select:none;position:sticky;top:0;z-index:4;background:var(--panel)}
.am-h:hover{background:var(--panel-3)}
.am-h.on{background:var(--primary-soft)}
.am-h .chev{transition:transform .15s;flex:0 0 auto;color:var(--muted)}
.am-h.closed .chev{transform:rotate(-90deg)}
.am-t{flex:1 1 auto;min-width:0;font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.am-h.on .am-t{color:var(--primary-2)}
.am-t mark{background:var(--mark-bg-2);color:var(--mark-text);border-radius:2px;padding:0 1px}
.cnt{flex:0 0 auto;font-size:11px;color:var(--muted);background:var(--panel-3);padding:1px 6px;border-radius:9px}
.cnt.f{background:var(--primary-soft);color:var(--primary-2);font-weight:600}
.am-tools{flex:0 0 auto;display:none;align-items:center;gap:3px}
.am-h:hover .am-tools{display:inline-flex}
.am-act{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:none;border-radius:5px;background:var(--panel-3);color:var(--text-2);cursor:pointer}
.am-act:hover{background:var(--hover);color:var(--primary)}
.am-body{min-width:0}
.am-none{padding:6px 8px 8px 20px;font-size:11.5px;color:var(--muted)}
.am-warn{display:flex;align-items:center;gap:5px;margin:4px 0 6px 20px;padding:5px 8px;border-radius:6px;background:var(--warn-soft);color:var(--warn-text);font-size:11.5px;line-height:1.5}
</style>
