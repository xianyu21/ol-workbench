<template>
  <div v-if="visible" class="upd-card" :class="'ph-' + update.phase">
    <!-- 下载中 -->
    <template v-if="update.phase === 'downloading'">
      <svg-icon name="box" :size="15" />
      <div class="uc-body">
        <a-progress :percent="pct" size="small" status="active" :show-info="false" />
        <div class="uc-txt">
          正在后台下载更新<template v-if="avail"> v{{ avail }}</template>
          <template v-if="retryText"> · {{ retryText }}</template>
          <template v-else> · {{ pct }}%</template>
        </div>
      </div>
    </template>

    <!-- 就绪，可立即重启安装 -->
    <template v-else-if="update.phase === 'ready'">
      <svg-icon name="box" :size="15" />
      <div class="uc-body">
        <span class="uc-txt">新版本<template v-if="ready"> v{{ ready }}</template> 已下载完成，重启后生效</span>
        <div class="uc-acts">
          <a-button type="primary" size="small" @click="update.installNow()">立即重启安装</a-button>
          <a-button size="small" type="text" @click="update.dismiss()">稍后</a-button>
        </div>
      </div>
    </template>

    <!-- 安装被 preflight 拦截 -->
    <template v-else-if="update.phase === 'install-blocked' && failure">
      <svg-icon name="alert" :size="15" />
      <div class="uc-body">
        <span class="uc-txt"><b>{{ failure.title }}</b> · {{ failure.hint }}</span>
        <div class="uc-acts">
          <a-button type="primary" size="small" @click="update.installNow()">重试</a-button>
          <a-button size="small" type="text" @click="update.dismiss()">稍后</a-button>
        </div>
      </div>
    </template>

    <!-- 下载失败（退避耗尽） -->
    <template v-else-if="update.phase === 'download-failed' && failure">
      <svg-icon name="alert" :size="15" />
      <div class="uc-body">
        <span class="uc-txt"><b>{{ failure.title }}</b> · {{ failure.hint }}</span>
        <div class="uc-acts">
          <a-button type="primary" size="small" @click="update.retryDownload()">重试下载</a-button>
        </div>
      </div>
    </template>

    <!-- 已回滚 -->
    <template v-else-if="update.phase === 'rolled-back'">
      <svg-icon name="history" :size="15" />
      <div class="uc-body">
        <span class="uc-txt">已回滚到上一可用版本<template v-if="status.lastKnownGood"> v{{ status.lastKnownGood }}</template></span>
      </div>
    </template>

    <!-- 回滚失败 -->
    <template v-else-if="update.phase === 'rollback-failed' && failure">
      <svg-icon name="alert" :size="15" />
      <div class="uc-body">
        <span class="uc-txt"><b>{{ failure.title }}</b> · {{ failure.hint }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { useUpdateStore } from '@/stores/update'

const update = useUpdateStore()
const status = update.status
const failure = computed(() => update.failure)
const pct = computed(() => update.progress || 0)
const avail = computed(() => update.availableVersion)
const ready = computed(() => update.readyVersion)

const retryText = computed(() => {
  if (update.phase !== 'downloading' || !update.retry.nextInMs) return ''
  const s = Math.ceil(update.retry.nextInMs / 1000)
  return `重试中（第 ${update.retry.attempt}/${update.retry.max} 次，约 ${s}s 后）`
})

const visible = computed(() => {
  if (update.dismissed) return false
  return ['downloading', 'ready', 'install-blocked', 'download-failed', 'rolled-back', 'rollback-failed'].includes(update.phase)
})
</script>

<style scoped>
.upd-card{position:fixed;right:16px;bottom:16px;z-index:1500;display:flex;align-items:center;gap:10px;max-width:320px;padding:10px 14px;border-radius:10px;background:var(--panel);border:1px solid var(--border);box-shadow:var(--sh-2,0 6px 20px rgba(0,0,0,.12));color:var(--text)}
.uc-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:4px}
.uc-txt{font-size:12.5px;color:var(--text-2);line-height:1.5}
.uc-acts{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.ph-install-blocked,.ph-download-failed,.ph-rollback-failed{color:var(--danger)}
</style>
