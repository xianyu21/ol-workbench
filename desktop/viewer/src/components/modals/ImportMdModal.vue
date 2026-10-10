<template>
  <a-modal :open="!!ui.importMd" :title="title" :width="560" :maskClosable="false" @cancel="close">
    <template #footer>
      <div class="im-btns">
        <a-button @click="close">取消</a-button>
        <a-button type="primary" :disabled="!item" :loading="saving" @click="confirm">{{ okText }}</a-button>
      </div>
    </template>

    <div class="im-tip">{{ tip }}</div>

    <div v-if="!replaceMode" class="im-src">
      <span class="im-src-l">来源</span>
      <a-radio-group v-model:value="srcMode" size="small" button-style="solid">
        <a-radio-button value="apifox">Apifox</a-radio-button>
        <a-radio-button value="apipost">Apipost</a-radio-button>
      </a-radio-group>
    </div>

    <div v-if="!replaceMode" class="im-name">
      <span class="im-src-l">模块名称</span>
      <a-input v-model:value="modName" :maxlength="60" allow-clear :placeholder="namePh" />
      <span class="im-name-h">选择文件后自动识别文件名，可修改</span>
    </div>

    <div class="im-drop" :class="{ over }" @click="pick"
      @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="onDrop">
      <svg-icon name="ul" :size="22" />
      <div class="im-d-t">点击选择一个 .md 文件，或拖到此处</div>
      <div class="im-d-s">支持 Apifox / Apipost 导出的 Markdown 接口文档（单次一个文件）</div>
    </div>

    <!-- 已登记文件：单击直接载入（单选，无勾选） -->
    <div class="im-dirs">
      <button type="button" class="im-dirs-btn" @click="toggleFiles">
        <svg-icon name="file" :size="14" />从已登记文件选择
        <span class="im-dirs-n">{{ api.files.length }} 个文件</span>
        <svg-icon :name="filesOpen ? 'chev' : 'chevR'" :size="12" />
      </button>
      <template v-if="filesOpen">
        <div v-if="!api.files.length" class="im-dirs-tip">尚未在 设置 → 工作目录 → API 文档 登记文件</div>
        <div v-else class="im-dirlist">
          <button v-for="f in regFiles" :key="f.path" class="im-df" :disabled="reading" @click="loadOne(f)">
            <svg-icon name="file" :size="13" />
            <span class="im-df-n" :title="f.path">{{ f.name }}</span>
            <span v-if="item && item.path === f.path" class="im-df-tag">已选</span>
          </button>
        </div>
      </template>
      <div v-else-if="!api.files.length" class="im-dirs-tip">可在 设置 → 工作目录 → API 文档 登记常用文件，之后一键选取</div>
    </div>

    <!-- 已选文件卡片 -->
    <div v-if="item" class="im-item">
      <svg-icon name="file" :size="14" />
      <div class="im-i-body">
        <div class="im-i-n" :title="item.name">{{ item.name }}</div>
        <div class="im-i-m">
          {{ sizeOf(item.size) }} ·
          <template v-if="item.parsed.endpoints.length">
            识别到 {{ item.parsed.endpoints.length }} 个接口<template v-if="item.parsed.source !== 'unknown'"> · {{ item.parsed.source }}</template>
          </template>
          <template v-else><span class="im-warn">未识别到接口</span></template>
          <template v-if="item.parsed.warnings.length"> · {{ item.parsed.warnings.length }} 条提示</template>
        </div>
        <div v-if="item.parsed.warnings.length" class="im-i-w">{{ item.parsed.warnings[0] }}</div>
      </div>
      <button class="im-i-x" title="移除" @click="clear"><svg-icon name="x" :size="12" /></button>
    </div>
  </a-modal>
  <input ref="fileRef" type="file" accept=".md,.markdown,text/markdown" style="display:none" @change="onFile">
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { host } from '@/host/index.js'
import { parseMarkdown, nameOfFile } from '@/lib/api-docs-md.js'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { useWorkspaceStore, useApiStore, useUiStore } from '@/stores'
const ws = useWorkspaceStore()
const apiStore = useApiStore()
const { ui } = useUiStore()
const { api } = apiStore

const fileRef = ref(null)
const item = ref(null)        // 单文件：{ name, path, size, text, parsed }
const modName = ref('')
const over = ref(false)
const saving = ref(false)
const srcMode = ref('apifox')

const target = computed(() => ui.importMd)
const replaceMode = computed(() => !!(target.value && target.value.replace))

const title = computed(() => replaceMode.value ? '重新导入覆盖' : '导入 Markdown')
const okText = computed(() => replaceMode.value ? '覆盖导入' : '导入为模块')
const tip = computed(() => {
  if (replaceMode.value) return '将替换该模块的文档内容，模块名称与已有设置保持不变。'
  return '一个 Markdown 文件成为一个业务模块，模块名默认取文件名，可修改。'
})
const namePh = computed(() => item.value ? '请输入模块名称' : '尚未选择文件')

watch(() => !!ui.importMd, v => { if (v) reset() })

function reset () {
  item.value = null
  modName.value = ''
  over.value = false
  srcMode.value = 'apifox'
  filesOpen.value = false
  regFiles.value = []
}

/* 载入单个文件 → 解析 + 以文件名自动填充模块名 */
function setItem (payload) {
  const parsed = parseMarkdown(payload.text, { name: nameOfFile(payload.name), source: srcMode.value })
  item.value = { name: payload.name, path: payload.path || '', size: payload.size || 0, text: payload.text, parsed }
  if (!replaceMode.value) modName.value = nameOfFile(payload.name)
}
function clear () { item.value = null; modName.value = '' }

/* 来源切换后重解析，保证卡片上显示的来源标记与选择一致 */
watch(srcMode, s => {
  if (!item.value) return
  item.value.parsed = parseMarkdown(item.value.text, { name: nameOfFile(item.value.name), source: s })
})

/* ---------- 从已登记的 API 文档文件选取（单击载入） ---------- */
const filesOpen = ref(false)
const reading = ref(false)
const regFiles = ref([])      // [{ name, path, size }]

function baseName (p) { const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')); return i >= 0 ? p.slice(i + 1) : p }

async function toggleFiles () {
  filesOpen.value = !filesOpen.value
  if (filesOpen.value && !regFiles.value.length) loadRegFiles()
}
function loadRegFiles () {
  if (!api.files.length) { message.info('请先在 设置 → 工作目录 → API 文档 登记文件'); filesOpen.value = false; return }
  regFiles.value = api.files.map(p => ({ name: baseName(p), path: p, size: 0 }))
}
async function loadOne (f) {
  if (!host.supports('readDocuments')) { message.warning('当前环境不支持读取文件'); return }
  reading.value = true
  try {
    const read = (await host.readDocuments([f])) || []
    const r = read[0]
    if (!r) { message.warning('未能读取该文件'); return }
    if (r.error) { message.warning(`「${r.name}」读取失败：${r.error === 'too-large' ? '文件超过 8MB 上限' : r.error}`); return }
    setItem({ name: r.name, path: r.path, size: r.size, text: r.text })
  } finally { reading.value = false }
}

function close () { ui.importMd = null }
function pick () { if (fileRef.value) { fileRef.value.value = ''; fileRef.value.click() } }
function onDrop (e) { over.value = false; addFiles(Array.from((e.dataTransfer && e.dataTransfer.files) || [])) }
function onFile (e) { addFiles(Array.from((e.target && e.target.files) || [])) }

function sizeOf (b) {
  if (!b) return '0 KB'
  if (b < 1048576) return Math.max(1, Math.round(b / 1024)) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

async function addFiles (list: File[]) {
  const md = list.filter(f => /\.(md|markdown)$/i.test(f.name))
  if (!md.length) { message.warning('请选择 .md 文件'); return }
  if (md.length > 1) message.info('单次仅支持一个文件，已取第一个')
  const f = md[0]
  if (f.size > 2 * 1024 * 1024 && !await confirmBig(f)) return
  let text = ''
  try { text = await f.text() } catch (e) { text = await readLegacy(f) }
  setItem({ name: f.name, size: f.size, text })
}

function confirmBig (f) {
  return new Promise(resolve => {
    Modal.confirm({
      title: '文件较大',
      content: `「${f.name}」约 ${sizeOf(f.size)}，导入后会占用本地存储空间，可能导致保存失败。仍要导入吗？`,
      okText: '仍要导入', cancelText: '跳过',
      onOk: () => resolve(true), onCancel: () => resolve(false)
    })
  })
}

function readLegacy (f): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const rd = new FileReader()
    rd.onload = () => resolve(String(rd.result || ''))
    rd.onerror = () => reject(rd.error)
    rd.readAsText(f)
  })
}

function confirm () {
  if (!item.value) return
  saving.value = true
  try {
    if (replaceMode.value) {
      const id = target.value.id
      apiStore.apiReplaceMd(id, item.value.text, item.value.name, item.value.size)
      const m = apiStore.apiModules.filter(x => x.mod.id === id)[0]
      if (m) apiStore.apiSelect(id, m.endpoints.length ? m.endpoints[0].id : null)
      message.success('已覆盖导入')
    } else {
      const name = (modName.value || '').trim() || nameOfFile(item.value.name)
      const ids = apiStore.apiImportFiles([{ name, fileName: item.value.name, size: item.value.size, text: item.value.text, src: srcMode.value }])
      message.success('已导入 1 个模块')
      selectJustImported(ids && ids[0])
    }
    close()
  } finally {
    saving.value = false
  }
}

/* 导入后选中刚生成的模块，避免右侧详情空白 */
function selectJustImported (id) {
  const list = apiStore.apiModules
  const m = id ? list.filter(x => x.mod.id === id)[0] : list[list.length - 1]
  if (!m) return
  apiStore.apiSelect(m.mod.id, m.endpoints.length ? m.endpoints[0].id : null)
}
</script>

<style scoped>
.im-tip{font-size:12.5px;color:var(--text-2);line-height:1.7;margin-bottom:12px}
.im-src,.im-name{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.im-src-l{flex:0 0 auto;font-size:12.5px;color:var(--text-2)}
.im-name :deep(.ant-input){flex:1 1 auto;min-width:0}
.im-name-h{flex:0 0 auto;font-size:11.5px;color:var(--muted)}
.im-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:20px;border:1.5px dashed var(--border);border-radius:var(--r);background:var(--panel-2);cursor:pointer;transition:border-color .12s,background .12s;text-align:center}
.im-drop:hover,.im-drop.over{border-color:var(--primary);background:var(--primary-soft)}
.im-drop svg{color:var(--muted)}
.im-d-t{font-size:13px;color:var(--text)}
.im-d-s{font-size:11.5px;color:var(--muted)}
.im-dirs{margin-top:10px}
.im-dirs-btn{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border:none;border-radius:6px;background:transparent;color:var(--primary-2);font-size:12.5px;cursor:pointer}
.im-dirs-btn:hover{background:var(--hover)}
.im-dirs-n{color:var(--muted);font-size:11.5px}
.im-dirs-tip{font-size:11.5px;color:var(--muted);padding:4px 8px}
.im-dirlist{margin-top:6px;max-height:200px;overflow:auto;display:flex;flex-direction:column;gap:2px;padding:6px;border:1px solid var(--border-2);border-radius:var(--r-sm);background:var(--panel-2)}
.im-df{display:flex;align-items:center;gap:8px;padding:5px 6px;border:none;border-radius:5px;background:transparent;font-size:12px;text-align:left;cursor:pointer}
.im-df:hover{background:var(--hover)}
.im-df:disabled{opacity:.6;cursor:default}
.im-df :deep(svg){flex:0 0 auto;color:var(--muted)}
.im-df-n{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
.im-df-tag{flex:0 0 auto;font-size:10.5px;color:var(--muted);border:1px solid var(--border-2);border-radius:8px;padding:0 6px}
.im-item{display:flex;align-items:flex-start;gap:8px;margin-top:12px;padding:8px 10px;border:1px solid var(--border-2);border-radius:var(--r-sm);background:var(--panel)}
.im-item > :deep(svg){flex:0 0 auto;color:var(--muted);margin-top:2px}
.im-i-body{flex:1 1 auto;min-width:0}
.im-i-n{font-size:12.5px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.im-i-m{font-size:11.5px;color:var(--muted);margin-top:2px}
.im-i-w{font-size:11.5px;color:var(--warn-text);margin-top:3px}
.im-warn{color:var(--warn)}
.im-i-x{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:none;border-radius:5px;background:transparent;color:var(--muted);cursor:pointer}
.im-i-x:hover{background:var(--hover);color:var(--danger)}
.im-btns{display:flex;gap:8px;justify-content:flex-end}
</style>
