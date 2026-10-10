<template>
  <div class="cp">
    <div class="cp-h">
      <span class="cp-t">代码示例</span>
      <span class="cp-sp" />
      <a-radio-group v-model:value="tab" size="small" class="cp-tabs">
        <a-radio-button value="req">请求示例</a-radio-button>
        <a-radio-button value="res">返回示例</a-radio-button>
      </a-radio-group>
    </div>
    <div class="cp-body">
      <ApiCodeBlock v-if="cur" :lang="cur.lang" :code="cur.code" />
      <div v-else class="cp-empty">
        <svg-icon name="box" :size="22" />
        <div>该接口没有{{ tab === 'req' ? '请求' : '返回' }}示例</div>
      </div>
      <template v-if="ep.extras && ep.extras.length">
        <div v-for="(x, i) in ep.extras" :key="i" class="cp-extra">
          <div class="cp-ex-t">{{ x.title }}</div>
          <ApiCodeBlock v-if="x.kind === 'code'" :lang="x.lang" :code="x.code" :clamp="20" />
          <div v-else class="cp-ex-tbl">
            <table class="pt">
              <thead><tr><th>名称</th><th>类型</th><th>说明</th></tr></thead>
              <tbody>
                <tr v-for="(r, j) in x.rows" :key="j">
                  <td class="pt-n">{{ r.name }}</td><td>{{ r.type }}</td><td>{{ r.desc }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import ApiCodeBlock from '@/components/api/ApiCodeBlock.vue'

const props = defineProps({ ep: { type: Object, required: true } })
const tab = ref('res')

/* 优先展示有内容的那一侧；切换接口时跟随 */
function pickDefault () {
  if (props.ep.resExample) return 'res'
  if (props.ep.reqExample) return 'req'
  return 'res'
}
watch(() => props.ep.id, () => { tab.value = pickDefault() }, { immediate: true })

const cur = computed(() => tab.value === 'req' ? props.ep.reqExample : props.ep.resExample)
</script>

<style scoped>
.cp{display:flex;flex-direction:column;min-height:0;height:100%}
.cp-h{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);background:var(--panel-2);flex-wrap:wrap}
.cp-t{font-size:13px;font-weight:600;color:var(--text)}
.cp-sp{flex:1 1 auto}
.cp-body{flex:1 1 auto;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.cp-empty{padding:26px 12px;text-align:center;color:var(--muted);font-size:12.5px;line-height:1.7}
.cp-empty svg{color:var(--empty-ico);margin-bottom:6px}
.cp-ex-t{font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:6px}
.cp-ex-tbl{border:1px solid var(--border);border-radius:var(--r-sm);overflow:auto}
.cp-ex-tbl .pt{width:100%;border-collapse:collapse;font-size:12px}
.cp-ex-tbl th{background:var(--tbl-head-bg);color:var(--text-2);text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)}
.cp-ex-tbl td{padding:6px 8px;border-bottom:1px solid var(--border-2);color:var(--text)}
</style>
