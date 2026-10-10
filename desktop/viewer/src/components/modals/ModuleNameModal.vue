<template>
  <a-modal :open="!!ui.apiModule" :title="isRename ? '重命名模块' : '新建业务模块'" :width="420"
    :maskClosable="false" @cancel="close">
    <template #footer>
      <div class="mn-btns">
        <a-button @click="close">取消</a-button>
        <a-button type="primary" :disabled="!name.trim()" @click="ok">{{ isRename ? '保存' : '创建' }}</a-button>
      </div>
    </template>
    <div class="mn-body">
      <div class="mn-lbl">模块名称</div>
      <a-input v-model:value="name" placeholder="例如：用户管理" allow-clear @pressEnter="ok" />
      <div class="mn-hint">{{ isRename ? '重命名只影响工作台内的显示名，不改动 Markdown 文件。' : '创建后会得到一个空模块，可在其右侧 + 导入 Markdown。' }}</div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useWorkspaceStore, useApiStore, useUiStore } from '@/stores'
const ws = useWorkspaceStore()
const apiStore = useApiStore()
const { ui } = useUiStore()
const { api } = apiStore

const name = ref('')
const isRename = computed(() => !!(ui.apiModule && ui.apiModule.mode === 'rename'))

watch(() => ui.apiModule, v => {
  if (!v) { name.value = ''; return }
  if (v.mode === 'rename') {
    const m = (api.docs.modules || []).filter(x => x.id === v.id)[0]
    name.value = m ? m.name : ''
  } else name.value = ''
})

function close () { ui.apiModule = null }
function ok () {
  const n = name.value.trim()
  if (!n) return
  if (isRename.value) {
    apiStore.apiRenameModule(ui.apiModule.id, n)
    message.success('已重命名')
  } else {
    const id = apiStore.apiAddModule(n)
    apiStore.apiSelect(id, null)
    message.success('已创建模块：' + n)
  }
  close()
}
</script>

<style scoped>
.mn-body{padding-top:4px}
.mn-lbl{font-size:12.5px;color:var(--text-2);margin-bottom:6px}
.mn-hint{font-size:11.5px;color:var(--muted);margin-top:8px;line-height:1.6}
.mn-btns{display:flex;gap:8px;justify-content:flex-end}
</style>
