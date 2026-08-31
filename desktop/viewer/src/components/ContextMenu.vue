<template>
  <teleport to="body">
    <div v-if="ctx.open" class="gctx" ref="boxRef"
      :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
      @click.stop @contextmenu.prevent>
      <template v-for="(it, i) in ctx.items" :key="i">
        <div v-if="it.divider" class="sp" />
        <div v-else-if="it.header" class="hd">{{ it.header }}</div>
        <button v-else :class="{ dg: it.danger }" @click="run(it)">
          <svg-icon :name="it.icon || 'box'" :size="14" /><span>{{ it.label }}</span>
        </button>
      </template>
    </div>
  </teleport>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ctx, hideCtx } from '../ctx.js'
import SvgIcon from './SvgIcon.vue'

const boxRef = ref(null)
const pos = computed(() => {
  // 先按默认位置渲染，再由 mounted 后的 clamp 修正；此处用简单的视口裁剪
  const w = 230, hEst = Math.min(ctx.items.length * 36 + 16, 420)
  return {
    x: Math.min(ctx.x, innerWidth - w - 8),
    y: Math.min(ctx.y, innerHeight - hEst - 8)
  }
})
function run (it) { hideCtx(); it.act && it.act() }
function onDocClick (e) { if (ctx.open && boxRef.value && !boxRef.value.contains(e.target)) hideCtx() }
function onScroll () { if (ctx.open) hideCtx() }
onMounted(() => {
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('scroll', onScroll, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('scroll', onScroll, true)
})
watch(() => ctx.open, v => { if (v) hideTipTimer() })
function hideTipTimer () { /* 预留 */ }
</script>

<style scoped>
.gctx{position:fixed;z-index:1200;background:var(--panel);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--sh-3);padding:5px;min-width:178px}
.gctx button{width:100%;display:flex;align-items:center;gap:9px;height:33px;padding:0 10px;border-radius:6px;font-size:13px;color:var(--text-2);text-align:left;background:none;border:none;cursor:pointer}
.gctx button:hover{background:var(--panel-3);color:var(--text)}
.gctx button.dg{color:var(--danger)}
.gctx button.dg:hover{background:var(--danger-soft)}
.sp{height:1px;background:var(--border-2);margin:4px 6px}
.hd{padding:6px 10px 5px;font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}
</style>
