<template>
  <div class="adm">
    <div class="adm-head">
      <h1 class="adm-title">{{ ep.name }}</h1>
      <div v-if="ep.summary && ep.summary !== ep.name" class="adm-sum">{{ ep.summary }}</div>
      <div class="adm-meta">
        <span class="mb" :class="mcls(ep.method)">{{ ep.method || 'ANY' }}</span>
        <span class="adm-path" :title="ep.path">{{ ep.path || '（未识别路径）' }}</span>
        <button class="adm-copy" title="复制路径" @click="copy(ep.path)"><svg-icon name="copy" :size="12" /></button>
        <span class="adm-sp" />
        <span v-if="mod && mod.fileName" class="adm-src">
          <svg-icon name="file" :size="11" />{{ mod.fileName }}
        </span>
        <span v-if="mod && mod.importedAt" class="adm-src">{{ fmtTime(mod.importedAt) }}</span>
      </div>
    </div>

    <div v-if="ep.warnings && ep.warnings.length" class="callout warn">
      <svg-icon name="warn" :size="15" />
      <div>
        <div v-for="(w, i) in ep.warnings" :key="i">{{ w }}</div>
      </div>
    </div>

    <p v-if="ep.desc" class="adm-desc">{{ ep.desc }}</p>

    <template v-for="sec in sections" :key="sec.key">
      <section v-if="sec.rows.length || sec.force" class="adm-sec">
        <div class="adm-sec-t">{{ sec.title }}<span class="n">{{ sec.rows.length }}</span></div>
        <ApiParamTable :rows="sec.rows" :title="sec.title" />
      </section>
    </template>

    <section v-if="!hasAny && !ep.desc" class="adm-sec">
      <div class="callout info">
        <svg-icon name="info" :size="15" />
        <div>该接口没有解析到结构化参数，可展开下方原文查看。</div>
      </div>
    </section>

    <section v-if="ep.raw" class="adm-sec">
      <div class="adm-sec-t">
        <button class="adm-raw-btn" @click="showRaw = !showRaw">
          <svg-icon name="chev" :size="12" :class="{ up: showRaw }" />原文
        </button>
      </div>
      <pre v-if="showRaw" class="adm-raw"><code>{{ ep.raw }}</code></pre>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import ApiParamTable from '@/components/api/ApiParamTable.vue'

const props = defineProps({
  ep: { type: Object, required: true },
  mod: { type: Object, default: null }
})

const showRaw = ref(false)

const SECTIONS = [
  { key: 'headers', title: '请求头' },
  { key: 'pathParams', title: '路径参数' },
  { key: 'query', title: 'Query 参数' },
  { key: 'body', title: '请求体' },
  { key: 'responses', title: '响应参数' }
]
const sections = computed(() => SECTIONS.map(s => ({ key: s.key, title: s.title, rows: props.ep[s.key] || [], force: false })))
const hasAny = computed(() => sections.value.some(s => s.rows.length))

function mcls (m) {
  const up = String(m || '').toUpperCase()
  return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].indexOf(up) >= 0 ? up : 'ANY'
}
function fmtTime (ts) {
  try { return new Date(ts).toLocaleString('zh-CN', { hour12: false }) } catch (e) { return '' }
}
function copy (t) {
  if (!t) return
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(() => message.success('已复制路径'), () => message.error('复制失败'))
  } else message.error('当前环境不支持复制')
}
</script>

<style scoped>
.adm{padding:18px 22px 40px;max-width:900px}
.adm-head{margin-bottom:14px}
.adm-title{font-size:19px;font-weight:650;color:var(--text);margin:0 0 4px;line-height:1.35}
.adm-sum{font-size:13px;color:var(--text-2);margin-bottom:10px}
.adm-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.adm-path{font-family:var(--font-mono,monospace);font-size:12.5px;color:var(--text-2);background:var(--panel-3);padding:3px 8px;border-radius:6px;max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.adm-copy{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:none;border-radius:5px;background:transparent;color:var(--muted);cursor:pointer}
.adm-copy:hover{background:var(--btn-soft);color:var(--primary)}
.adm-sp{flex:1 1 auto}
.adm-src{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--muted)}
.adm-desc{font-size:13px;line-height:1.75;color:var(--text-2);margin:0 0 16px;white-space:pre-wrap}
.adm-sec{margin-bottom:18px}
.adm-sec-t{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.6px;margin-bottom:7px}
.adm-sec-t .n{font-weight:600;letter-spacing:0;background:var(--panel-3);padding:1px 6px;border-radius:9px}
.adm-raw-btn{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border:1px solid var(--border);border-radius:6px;background:var(--panel);color:var(--text-2);font-size:11.5px;font-weight:600;letter-spacing:0;cursor:pointer}
.adm-raw-btn:hover{background:var(--hover);color:var(--text)}
.adm-raw-btn .up{transform:rotate(180deg)}
.adm-raw{margin:0;padding:12px;border:1px solid var(--code-border);border-radius:var(--r-sm);background:var(--code-bg);color:var(--code-text);font-family:var(--font-mono,monospace);font-size:12px;line-height:1.6;overflow:auto;max-height:420px;white-space:pre-wrap}
.callout{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:var(--r-sm);font-size:12.5px;line-height:1.65;margin-bottom:14px}
.callout.warn{background:var(--warn-soft);border:1px solid var(--warn-border);color:var(--warn-text)}
.callout.info{background:var(--info-soft);border:1px solid var(--info-border);color:var(--info-text)}
</style>
