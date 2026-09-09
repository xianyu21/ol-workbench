<template>
  <a-modal :open="ui.backup" title="恢复备份" :footer="null" :width="520" @cancel="ui.backup = false">
    <a-alert type="info" show-icon style="margin-bottom:14px">
      <template #message>
        标签、收藏、标签页布局保存在<b>磁盘</b>（桌面端）或浏览器本地（浏览器端）。桌面端换端口、清缓存、升级版本都不会丢失；如有旧备份可用下方「导入恢复」迁移。AxHub 文件本身在磁盘不受影响。
      </template>
    </a-alert>
    <div style="display:flex;gap:9px;margin-bottom:16px">
      <a-button type="primary" block style="flex:1;height:42px" @click="pickImport">
        <template #icon><svg-icon name="ul" :size="16" /></template>导入恢复
      </a-button>
    </div>
    <div class="rowsp">
      <div>
        <b>当前记录</b>
        <div class="hint">{{ store.projects.length }} 个页面 · {{ store.tags.length }} 个标签</div>
      </div>
    </div>
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-2)">
      <a-button danger block style="height:40px" @click="clearAll">
        <template #icon><svg-icon name="trash" :size="15" /></template>清空全部本地数据
      </a-button>
      <div class="hint" style="margin-top:7px;text-align:center">只清工作台记录，不删磁盘 AxHub 文件。</div>
    </div>
  </a-modal>
  <input ref="fileRef" type="file" accept=".json,application/json" style="display:none" @change="onFile">
</template>

<script setup>
import { ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import SvgIcon from '../SvgIcon.vue'
import { store, persist, DEF_TAGS } from '../../store.js'
import * as userData from '../../user-data.js'
import * as library from '../../library.js'
import { ui } from '../../ui.js'

const fileRef = ref(null)

function pickImport () { fileRef.value.value = ''; fileRef.value.click() }
function onFile (e) {
  const f = e.target.files && e.target.files[0]
  if (!f) return
  const rd = new FileReader()
  rd.onload = () => {
    let d
    try { d = JSON.parse(rd.result) } catch (err) { message.error('不是有效 JSON'); return }
    if (!d || !d.projects || !d.projects.length) { message.error('不是本工作台备份'); return }
    Modal.confirm({
      title: '导入恢复',
      content: `备份含 ${d.projects.length} 个页面、${(d.tags || []).length} 个标签。`,
      okText: '合并导入', cancelText: '取消',
      onOk: () => doImport(d, 'merge')
    })
  }
  rd.readAsText(f)
}
function doImport (d, mode) {
  if (mode === 'replace') {
    store.projects = d.projects
    store.tags = d.tags || DEF_TAGS
    store.tabs = d.tabs || []
    store.active = d.active || null
    store.recent = d.recent || []
    message.success('已覆盖导入', 2.6)
  } else {
    // 合并规则（并集/取大/重命名优先）单源在 library.js，可独立单测
    const r = library.mergeProjects(store.projects, d.projects)
    store.projects = r.projects
    store.tags = library.mergeTags(store.tags, d.tags || [])
    message.success(`合并完成：新增 ${r.add}、更新 ${r.updated}`, 3)
  }
  persist()
}
function clearAll () {
  Modal.confirm({
    title: '清空全部本地数据',
    content: `删除全部记录：${store.projects.length} 个页面列表项、${store.tags.length} 个标签、所有标签页布局。\n\n不删磁盘 AxHub 文件，重新扫描可恢复列表（但标签/收藏找不回）。`,
    okText: '确认清空', okType: 'danger', cancelText: '取消',
    onOk () {
      userData.clear() // 缓存与桌面端磁盘快照一并清（否则重启后快照会把数据灌回来）
      location.reload()
    }
  })
}
</script>

<style scoped>
.rowsp{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-2)}
.rowsp b{font-size:13px;font-weight:600}
.hint{font-size:11.5px;color:var(--muted);margin-top:4px;line-height:1.55}
</style>
