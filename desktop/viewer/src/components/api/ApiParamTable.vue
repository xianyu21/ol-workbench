<template>
  <div v-if="!rows.length" class="pt-empty">该接口未标注{{ title }}</div>
  <div v-else class="pt-wrap">
    <table class="pt">
      <thead>
        <tr><th>名称</th><th>类型</th><th>必填</th><th>说明</th><th>示例</th></tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="i">
          <td><span class="pt-n" :style="{ paddingLeft: (r.depth || 0) * 12 + 'px' }">{{ r.name }}</span></td>
          <td><span v-if="r.type" class="pt-t">{{ r.type }}</span><span v-else class="pt-na">—</span></td>
          <td><span v-if="r.required" class="pt-req">必填</span><span v-else class="pt-opt">可选</span></td>
          <td class="pt-d">{{ r.desc }}</td>
          <td class="pt-e">{{ r.example }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue'
defineProps({
  rows: { type: Array as PropType<any[]>, default: () => [] },
  title: { type: String, default: '参数' }
})
</script>

<style scoped>
.pt-wrap{border:1px solid var(--border);border-radius:var(--r-sm);overflow:auto;max-width:100%}
.pt{width:100%;border-collapse:collapse;font-size:12.5px;table-layout:auto}
.pt th{position:sticky;top:0;z-index:1;background:var(--tbl-head-bg);color:var(--text-2);font-weight:600;text-align:left;padding:7px 10px;border-bottom:1px solid var(--border);white-space:nowrap}
.pt td{padding:7px 10px;border-bottom:1px solid var(--border-2);color:var(--text);vertical-align:top}
.pt tbody tr:nth-child(even){background:var(--tbl-stripe)}
.pt tbody tr:hover{background:var(--hover-2)}
.pt-n{font-family:var(--font-mono,monospace);font-weight:600;white-space:nowrap}
.pt-t{font-family:var(--font-mono,monospace);font-size:11.5px;color:var(--primary-2)}
.pt-na{color:var(--muted)}
.pt-req{display:inline-block;font-size:10.5px;font-weight:600;color:var(--m-req-text);background:var(--m-req-bg);padding:1px 6px;border-radius:4px}
.pt-opt{display:inline-block;font-size:10.5px;color:var(--muted);background:var(--panel-3);padding:1px 6px;border-radius:4px}
.pt-d{color:var(--text-2);line-height:1.6;min-width:120px}
.pt-e{font-family:var(--font-mono,monospace);font-size:11.5px;color:var(--muted);white-space:nowrap}
.pt-empty{padding:10px 12px;border:1px dashed var(--border);border-radius:var(--r-sm);color:var(--muted);font-size:12.5px}
</style>
