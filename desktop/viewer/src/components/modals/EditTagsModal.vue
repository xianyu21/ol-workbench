<template>
  <a-modal :open="!!p" title="编辑标签" ok-text="保存" cancel-text="取消"
    :width="480" @ok="ok" @cancel="ui.editTagsPid = null">
    <div class="fld">
      <div class="lbl">选择标签（可多选）</div>
      <div class="pickwrap">
        <button v-for="t in store.tags" :key="t.name" class="pick" :class="{ on: sel.indexOf(t.name) >= 0 }"
          :style="sel.indexOf(t.name) >= 0 ? { color: t.color } : {}" @click="toggle(t.name)">
          <span class="dot" :style="{ background: t.color }" />{{ t.name }}
        </button>
      </div>
    </div>
    <div class="fld">
      <div class="lbl">新建标签</div>
      <div style="display:flex;gap:7px">
        <a-input v-model:value="newTag" placeholder="输入标签名后回车" @pressEnter="addTag" />
        <a-button @click="addTag">添加</a-button>
      </div>
      <div class="hint">标签用于左侧筛选。</div>
    </div>
  </a-modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { store, persist, getP, ensureTag } from '../../store.js'
import { ui } from '../../ui.js'

const p = computed(() => (ui.editTagsPid ? getP(ui.editTagsPid) : null))
const sel = ref([])
const newTag = ref('')
watch(p, v => { sel.value = v ? (v.tags || []).slice() : [] })

function toggle (n) {
  const i = sel.value.indexOf(n)
  if (i >= 0) sel.value.splice(i, 1)
  else sel.value.push(n)
}
function addTag () {
  const v = newTag.value.trim()
  if (!v) return
  if (v.length > 12) { message.warning('标签名过长（≤12字）'); return }
  ensureTag(v)
  persist()
  if (sel.value.indexOf(v) < 0) sel.value.push(v)
  newTag.value = ''
}
function ok () {
  if (!p.value) return
  p.value.tags = sel.value.slice()
  persist()
  ui.editTagsPid = null
  message.success('标签已更新')
}
</script>

<style scoped>
.fld{margin-bottom:14px}
.fld:last-child{margin-bottom:0}
.lbl{font-size:12.5px;font-weight:600;color:var(--text-2);margin-bottom:6px}
.hint{font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.6}
.pickwrap{display:flex;flex-wrap:wrap;gap:6px}
.pick{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:20px;font-size:12.5px;background:var(--panel-3);color:var(--text-2);border:1.5px solid transparent;cursor:pointer}
.pick.on{background:#fff;border-color:currentColor;font-weight:600}
.pick .dot{width:8px;height:8px;border-radius:50%}
</style>
