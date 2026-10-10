<template>
  <div class="ep" :class="{ on: selected }" @click="$emit('pick')" @contextmenu.prevent="$emit('menu')">
    <span class="mb" :class="mcls(ep.method)">{{ ep.method || 'ANY' }}</span>
    <span class="ep-body">
      <span class="ep-name"><span v-html="hi(ep.name, api.q)"></span></span>
      <span class="ep-path"><span v-html="hi(ep.path, api.q)"></span></span>
    </span>
  </div>
</template>

<script setup lang="ts">
const { api } = useApiStore()
import { hi, mcls } from '@/components/api/api-shared.js'
import { useApiStore } from '@/stores'

defineProps({
  ep: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})
defineEmits(['pick', 'menu'])
</script>

<style scoped>
.ep{display:flex;align-items:center;gap:7px;padding:5px 8px 5px 20px;border-radius:var(--r-sm);cursor:pointer}
.ep:hover{background:var(--panel-3)}
.ep.on{background:var(--primary-soft)}
.ep-body{flex:1 1 auto;min-width:0}
.ep-name{display:block;font-size:12.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ep.on .ep-name{color:var(--primary-2);font-weight:600}
.ep-name mark{background:var(--mark-bg-2);color:var(--mark-text);border-radius:2px;padding:0 1px}
.ep-path{display:block;font-size:11px;color:var(--muted);font-family:var(--font-mono,monospace);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style>
