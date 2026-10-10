<template>
  <a-modal :open="ui.tagManage" title="标签管理" ok-text="完成" cancel-text=""
    :width="520" :closable="true" @ok="ui.tagManage = false" @cancel="ui.tagManage = false">
    <div class="fld">
      <div class="lbl">全部标签</div>
      <div v-if="!ws.tags.length" class="empty-sm">还没有标签</div>
      <div v-else class="tglist">
        <div v-for="(t, i) in ws.tags" :key="t.name + i" class="tgrow">
          <span class="dot" title="点击换色" :style="{ background: t.color }" @click="cycleColor(i)" />
          <a-input v-model:value="t.name" size="small" @change="e => renameTag(i, e.target.value)" />
          <span class="cnt">{{ usedCount(t.name) }} 个</span>
          <a-button size="small" type="text" danger @click="removeTag(i)">
            <template #icon><svg-icon name="trash" :size="14" /></template>
          </a-button>
        </div>
      </div>
    </div>
    <div class="fld">
      <div style="display:flex;gap:7px">
        <a-input v-model:value="newName" placeholder="新标签名称" @pressEnter="addTag" />
        <a-button @click="addTag"><svg-icon name="plus" :size="14" />&nbsp;新建</a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { useWorkspaceStore, useUiStore } from '@/stores'
const ws = useWorkspaceStore()
const { ui } = useUiStore()

const newName = ref('')
const usedCount = n => ws.projects.filter(p => (p.tags || []).indexOf(n) >= 0).length

function cycleColor (i) {
  const cur = ws.PALETTE.indexOf(ws.tags[i].color)
  ws.tags[i].color = ws.PALETTE[(cur + 1) % ws.PALETTE.length]
  ws.persist()
}
function renameTag (i, nv) {
  const t = ws.tags[i]
  const ov = t.name
  nv = (nv || '').trim()
  if (!nv || nv === ov) { t.name = ov; return }
  if (ws.tags.some((x, k) => k !== i && x.name === nv)) { message.warning('已有同名标签'); t.name = ov; return }
  t.name = nv
  ws.projects.forEach(p => {
    if (!p.tags) return
    const k = p.tags.indexOf(ov)
    if (k >= 0) p.tags[k] = nv
  })
  ws.filterTags = ws.filterTags.map(x => (x === ov ? nv : x))
  ws.persist()
  message.success('已改名')
}
function removeTag (i) {
  const nm = ws.tags[i].name
  Modal.confirm({
    title: '删除标签',
    content: `删除「${nm}」，同时摘掉所有页面上的该标签。`,
    okText: '删除', okType: 'danger', cancelText: '取消',
    onOk () {
      ws.tags.splice(i, 1)
      ws.projects.forEach(p => { if (p.tags) p.tags = p.tags.filter(t => t !== nm) })
      ws.filterTags = ws.filterTags.filter(t => t !== nm)
      ws.persist()
      message.success('已删除')
    }
  })
}
function addTag () {
  const v = newName.value.trim()
  if (!v) { message.warning('请输入标签名'); return }
  if (v.length > 12) { message.warning('标签名过长（≤12字）'); return }
  if (ws.tags.some(t => t.name === v)) { message.warning('已有同名标签'); return }
  ws.ensureTag(v)
  ws.persist()
  newName.value = ''
  message.success('已新建')
}
</script>

<style scoped>
.fld{margin-bottom:14px}
.lbl{font-size:12.5px;font-weight:600;color:var(--text-2);margin-bottom:6px}
.tglist{display:flex;flex-direction:column;gap:6px}
.tgrow{display:flex;align-items:center;gap:8px;padding:4px 9px;background:var(--panel-2);border:1px solid var(--border);border-radius:var(--r-sm)}
.tgrow .dot{width:12px;height:12px;border-radius:50%;flex:0 0 auto;cursor:pointer;box-shadow:0 0 0 2px var(--panel),0 0 0 3px var(--border)}
.tgrow .cnt{font-size:11.5px;color:var(--muted);white-space:nowrap}
.empty-sm{padding:14px;text-align:center;color:var(--muted);font-size:13px}
</style>
