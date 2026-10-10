<template>
  <nav class="rail">
    <a-tooltip placement="right" title="原型视图（页面预览）" :mouseEnterDelay="0.4">
      <button class="rb" :class="{ on: !isApi }" @click="go('proto')">
        <svg-icon name="layers" :size="19" />
      </button>
    </a-tooltip>
    <a-tooltip placement="right" :title="apiTip" :mouseEnterDelay="0.4">
      <button class="rb" :class="{ on: isApi }" @click="go('api')">
        <svg-icon name="code" :size="19" />
      </button>
    </a-tooltip>
    <span v-if="isApi && modCount" class="rb-n">{{ modCount }}</span>
    <div class="rail-sp" />
    <a-tooltip placement="right" title="设置" :mouseEnterDelay="0.4">
      <button class="rb sm" @click="ui.settings = true"><svg-icon name="gear" :size="17" /></button>
    </a-tooltip>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { useSettingsStore, useApiStore, useUiStore } from '@/stores'

const router = useRouter()
const route = useRoute()
const { settings } = useSettingsStore()
const apiStore = useApiStore()
const { ui } = useUiStore()

/* 视图模式与路由同源：路由参数为准，settings.viewMode 只负责持久化（App.vue 同步） */
const isApi = computed(() => route.params.view === 'api')
function go (view) {
  if (route.params.view === view) return
  router.push('/' + view)
}

const modCount = computed(() => (apiStore.api.docs.modules || []).length)
const apiTip = computed(() => 'API 视图（接口文档）' + (modCount.value ? ' · ' + modCount.value + ' 个模块' : ''))
</script>

<style scoped>
.rail{flex:0 0 48px;width:48px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 0;background:var(--panel-2);border-right:1px solid var(--border);position:relative;z-index:31}
.rb{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;color:var(--muted);background:none;border:none;padding:0;cursor:pointer;transition:background .12s,color .12s}
.rb:hover{background:var(--hover);color:var(--text)}
.rb.on{background:var(--primary-soft);color:var(--primary-2);box-shadow:inset 2px 0 0 var(--primary)}
.rb.sm{width:30px;height:30px}
.rb-n{font-size:10px;color:var(--muted);line-height:1;margin-top:-4px}
.rail-sp{flex:1 1 auto}
</style>
