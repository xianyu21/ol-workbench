<template>
  <a-modal :open="ui.backup" title="恢复备份" :footer="null" :width="520" @cancel="ui.backup = false">
    <a-alert type="info" show-icon style="margin-bottom:14px">
      <template #message>
        标签、收藏、标签页布局保存在<b>磁盘</b>（桌面端）或浏览器本地（浏览器端）。桌面端换端口、清缓存、升级版本都不会丢失；如有旧备份可用下方「导入恢复」迁移。AxHub 文件本身在磁盘不受影响。
      </template>
    </a-alert>
    <div style="display:flex;gap:9px;margin-bottom:16px">
      <a-button block style="flex:1;height:42px" @click="exportBackup">
        <template #icon><svg-icon name="dl" :size="16" /></template>导出备份
      </a-button>
      <a-button type="primary" block style="flex:1;height:42px" @click="pickImport">
        <template #icon><svg-icon name="ul" :size="16" /></template>导入恢复
      </a-button>
    </div>
    <div class="rowsp">
      <div>
        <b>当前记录</b>
        <div class="hint">{{ ws.projects.length }} 个页面 · {{ ws.tags.length }} 个标签 · {{ modCount }} 个接口模块</div>
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

<script setup lang="ts">
import { ref, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import * as userData from '@/lib/user-data.js'
import * as library from '@/lib/library.js'
import * as apiLib from '@/lib/api-docs.js'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { useWorkspaceStore, useTabsStore, useApiStore, useUiStore } from '@/stores'
const ws = useWorkspaceStore()
const tabStore = useTabsStore()
const apiStore = useApiStore()
const { ui } = useUiStore()
const { api } = apiStore

const fileRef = ref(null)
const modCount = computed(() => (api.docs.modules || []).length)

/* 导出：按 user-keys.js 的 KEYS 清单组快照（新增持久化字段自动纳入）
 * 读走持久层唯一出口 userData.readSnapshot() —— 业务层禁止直调 localStorage。 */
function exportBackup () {
  const snap = userData.readSnapshot(false)
  const d = new Date()
  const p = n => (n < 10 ? '0' + n : '' + n)
  const stamp = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate())
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'axhub-backup-' + stamp + '.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  message.success('已导出备份文件', 2.4)
}

function pickImport () { fileRef.value.value = ''; fileRef.value.click() }
function onFile (e) {
  const f = e.target.files && e.target.files[0]
  if (!f) return
  const rd = new FileReader()
  rd.onload = () => {
    let d
    try { d = JSON.parse(rd.result as unknown as string) } catch (err) { message.error('不是有效 JSON'); return }
    // 只含接口模块的备份同样合法（projects 与 apiDocs 任一非空即可）
    const nP = (d && d.projects && d.projects.length) || 0
    const nM = (d && d.apiDocs && d.apiDocs.modules && d.apiDocs.modules.length) || 0
    if (!d || (!nP && !nM)) { message.error('不是本工作台备份'); return }
    Modal.confirm({
      title: '导入恢复',
      content: `备份含 ${nP} 个页面、${(d.tags || []).length} 个标签、${nM} 个接口模块。`,
      okText: '合并导入', cancelText: '取消',
      onOk: () => doImport(d, 'merge')
    })
  }
  rd.readAsText(f)
}
function doImport (d, mode) {
  let extra = ''
  if (mode === 'replace') {
    ws.projects = d.projects || []
    ws.tags = d.tags || ws.DEF_TAGS
    tabStore.tabs = d.tabs || []
    tabStore.active = d.active || null
    ws.recent = d.recent || []
    message.success('已覆盖导入', 2.6)
  } else {
    // 合并规则（并集/取大/重命名优先）单源在 library.js，可独立单测
    if (d.projects && d.projects.length) {
      const r = library.mergeProjects(ws.projects, d.projects)
      ws.projects = r.projects
      ws.tags = library.mergeTags(ws.tags, d.tags || [])
      extra = `页面新增 ${r.add}、更新 ${r.updated}`
    }
    message.success(extra ? `合并完成：${extra}` : '已合并导入', 3)
  }
  ws.persist()
  // 接口模块：按 id 去重取新（备份为准）
  if (d.apiDocs && d.apiDocs.modules && d.apiDocs.modules.length) {
    api.docs = apiLib.mergeApiDocs(api.docs, d.apiDocs)
    apiStore.persistApi()
    message.success(`已恢复 ${d.apiDocs.modules.length} 个接口模块`, 2.6)
  }
}
function clearAll () {
  Modal.confirm({
    title: '清空全部本地数据',
    content: `删除全部记录：${ws.projects.length} 个页面列表项、${ws.tags.length} 个标签、所有标签页布局。\n\n不删磁盘 AxHub 文件，重新扫描可恢复列表（但标签/收藏找不回）。`,
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
