<template>
  <div class="adp">
    <div class="adp-bar">
      <template v-for="(c, i) in crumbs" :key="i">
        <span v-if="i" class="cr-sep">›</span>
        <span class="cr-item" :class="{ last: i === crumbs.length - 1 }" :title="c">{{ c }}</span>
      </template>
      <span class="cr-sp" />
      <a-tooltip :title="showCode ? '隐藏代码示例' : '显示代码示例'">
        <button class="cr-btn" :class="{ on: showCode }" @click="showCode = !showCode">
          <svg-icon name="columns" :size="14" />
        </button>
      </a-tooltip>
    </div>

    <div class="adp-body" :class="{ 'no-code': !showCode }">
      <div v-if="!modCount" class="adp-empty">
        <svg-icon name="code" :size="30" />
        <b>还没有接口模块</b>
        <p>把 Apifox / Apipost 导出的 Markdown 导入进来，即可在这里按业务模块查阅接口文档。</p>
        <a-button type="primary" size="small" @click="ui.importMd = {}">
          <template #icon><svg-icon name="ul" :size="13" /></template>导入 Markdown
        </a-button>
      </div>
      <div v-else-if="!ep" class="adp-empty">
        <svg-icon name="file" :size="30" />
        <b>未选择接口</b>
        <p>在左侧业务模块中选择一个接口查看详细定义。</p>
      </div>
      <template v-else>
        <div class="adp-doc api-doc-scroll"><ApiDocMain :ep="ep" :mod="mod" /></div>
        <div v-if="showCode" class="adp-code api-code-scroll"><ApiCodePanel :ep="ep" /></div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import ApiCodePanel from '@/components/api/ApiCodePanel.vue'
import ApiDocMain from '@/components/api/ApiDocMain.vue'
import { useApiStore, useUiStore } from '@/stores'
const apiStore = useApiStore()
const { ui } = useUiStore()

const showCode = ref(true)
const modCount = computed(() => (apiStore.apiModules || []).length)
const mod = computed(() => (apiStore.apiActiveModule && apiStore.apiActiveModule.mod) || null)
const ep = computed(() => apiStore.apiActiveEp)

const crumbs = computed(() => {
  const out = ['API 视图']
  if (mod.value) out.push(mod.value.name)
  if (ep.value) out.push(ep.value.name)
  return out
})
</script>

<style scoped>
.adp{flex:1 1 auto;display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--bg)}
.adp-bar{flex:0 0 auto;display:flex;align-items:center;gap:7px;padding:6px 12px;font-size:12.5px;background:var(--panel);border-bottom:1px solid var(--border)}
.cr-sep{color:var(--muted)}
.cr-item{color:var(--text-2);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cr-item.last{color:var(--text);font-weight:600}
.cr-sp{flex:1 1 auto}
.cr-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:none;border-radius:6px;background:transparent;color:var(--muted);cursor:pointer}
.cr-btn:hover{background:var(--btn-soft);color:var(--text)}
.cr-btn.on{color:var(--primary);background:var(--primary-soft)}
.adp-body{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 420px}
.adp-body.no-code{grid-template-columns:minmax(0,1fr)}
.adp-doc{min-width:0;overflow-y:auto;overflow-x:hidden}
.adp-code{min-width:0;overflow-y:auto;border-left:1px solid var(--border);background:var(--panel)}
.adp-empty{flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:30px;text-align:center;color:var(--muted);font-size:13px;line-height:1.7;grid-column:1/-1}
.adp-empty svg{color:var(--empty-ico)}
.adp-empty b{color:var(--text-2);font-size:14px}
.adp-empty p{margin:0;max-width:420px}
@media (max-width:1180px){
  .adp-body,.adp-body.no-code{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto}
  .adp-code{border-left:0;border-top:1px solid var(--border);max-height:46vh}
}
</style>
