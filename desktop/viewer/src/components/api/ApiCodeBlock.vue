<template>
  <div class="cb">
    <div class="cb-h">
      <span class="cb-lang">{{ lang || 'text' }}</span>
      <span class="cb-sp" />
      <button class="cb-copy" @click="copy">
        <svg-icon name="copy" :size="12" /><span>{{ copied ? '已复制' : '复制' }}</span>
      </button>
    </div>
    <pre class="cb-code"><code>{{ shown }}</code></pre>
    <button v-if="clamped" class="cb-more" @click="expand = !expand">{{ expand ? '收起' : '展开全部（' + lines + ' 行）' }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import SvgIcon from '@/components/common/SvgIcon.vue'

const props = defineProps({
  code: { type: String, default: '' },
  lang: { type: String, default: '' },
  clamp: { type: Number, default: 30 }
})

const expand = ref(false)
const copied = ref(false)
const lines = computed(() => String(props.code || '').split('\n').length)
const clamped = computed(() => lines.value > props.clamp)
const shown = computed(() => {
  const s = String(props.code || '')
  if (!clamped.value || expand.value) return s
  return s.split('\n').slice(0, props.clamp).join('\n') + '\n…'
})

function copy () {
  const t = String(props.code || '')
  if (!t) return
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(() => {
      copied.value = true
      message.success('已复制代码')
      setTimeout(() => { copied.value = false }, 1600)
    }, () => message.error('复制失败'))
  } else message.error('当前环境不支持复制')
}
</script>

<style scoped>
.cb{border:1px solid var(--code-border);border-radius:var(--r-sm);background:var(--code-bg);overflow:hidden}
.cb-h{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--code-head-bg);border-bottom:1px solid var(--code-border)}
.cb-lang{font-size:11px;color:var(--code-text-2);font-family:var(--font-mono,monospace);text-transform:lowercase}
.cb-sp{flex:1 1 auto}
.cb-copy{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:5px;border:none;background:transparent;color:var(--code-text-2);font-size:11.5px;cursor:pointer}
.cb-copy:hover{background:var(--btn-soft);color:var(--text)}
.cb-code{margin:0;padding:10px 12px;overflow:auto;max-height:460px;font-family:var(--font-mono,monospace);font-size:12px;line-height:1.65;color:var(--code-text);white-space:pre;tab-size:2}
.cb-more{display:block;width:100%;padding:6px;border:none;border-top:1px solid var(--code-border);background:var(--code-head-bg);color:var(--code-text-2);font-size:11.5px;cursor:pointer}
.cb-more:hover{color:var(--primary)}
</style>
