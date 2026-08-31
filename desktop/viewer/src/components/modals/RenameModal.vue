<template>
  <a-modal :open="!!p" title="重命名" ok-text="保存" cancel-text="取消"
    :width="440" @ok="ok" @cancel="ui.renamePid = null">
    <div class="fld">
      <div class="lbl">显示名称</div>
      <a-input v-model:value="name" placeholder="输入新名称" @pressEnter="ok" />
      <div class="hint">不改磁盘文件名，重新扫描也不覆盖。</div>
    </div>
  </a-modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { store, getP, renameProject } from '../../store.js'
import { ui } from '../../ui.js'

const p = computed(() => (ui.renamePid ? getP(ui.renamePid) : null))
const name = ref('')
watch(p, v => { name.value = v ? v.name : '' })

function ok () {
  if (!name.value.trim()) { message.warning('名称不能为空'); return }
  renameProject(ui.renamePid, name.value)
  ui.renamePid = null
  message.success('已重命名')
}
</script>

<style scoped>
.lbl{font-size:12.5px;font-weight:600;color:var(--text-2);margin-bottom:6px}
.hint{font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.6}
</style>
