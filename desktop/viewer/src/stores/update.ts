import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { host } from '@/host/index.js'
import type {
  UpdateChannel,
  UpdateStatus,
  UpdatePhase,
  UpdateEvent,
  FailureDescriptor,
  RetryState
} from '@/lib/update-types'

/**
 * 更新状态机（渲染层唯一状态源）。
 * 主进程侧为事件驱动，状态存 config.update；两侧经 update:event 多路复用同步。
 */
export const useUpdateStore = defineStore('update', () => {
  const phase = ref<UpdatePhase>('idle')
  const status = reactive<UpdateStatus>({
    version: '',
    channel: 'stable',
    lastKnownGood: '',
    portable: false
  })
  const progress = ref<number | null>(null)   // null = 未在下载
  const availableVersion = ref('')
  const readyVersion = ref('')
  const dismissed = ref(false)                // 用户点「稍后」临时候隐藏
  const failure = ref<FailureDescriptor | null>(null)
  const retry = reactive<RetryState>({
    attempt: 0,
    max: 3,
    nextInMs: null,
    error: null,
    exhausted: false
  })

  function setStatus (s: Partial<UpdateStatus>) {
    if (s.version != null) status.version = s.version
    if (s.channel != null) status.channel = s.channel as UpdateChannel
    if (s.lastKnownGood != null) status.lastKnownGood = s.lastKnownGood
    if (s.portable != null) status.portable = s.portable
  }

  function resetTransient () {
    progress.value = null
    failure.value = null
    retry.attempt = 0
    retry.nextInMs = null
    retry.error = null
    retry.exhausted = false
    dismissed.value = false
  }

  /* 拉取当前状态（版本/渠道/lkg/portable） */
  async function refreshStatus () {
    if (!host.supports('updateStatus')) return
    try {
      const s = await host.updateStatus()
      if (s) setStatus(s)
    } catch (e) { /* ignore */ }
  }

  /* 消费主进程发来的 update:event 多路事件 */
  function handleEvent (ev: UpdateEvent) {
    const p = ev.payload as any
    switch (ev.type) {
      case 'status':
        setStatus(p || {})
        break
      case 'install-blocked':
        phase.value = 'install-blocked'
        failure.value = (p as FailureDescriptor) || null
        break
      case 'install-failed':
        phase.value = 'install-blocked'
        failure.value = (p as FailureDescriptor) || null
        break
      case 'first-launch-failed':
        phase.value = 'rollback-failed'
        break
      case 'download-retry':
        phase.value = 'downloading'
        retry.attempt = (p && p.attempt) || retry.attempt
        retry.max = (p && p.max) || retry.max
        retry.nextInMs = (p && p.nextInMs) != null ? p.nextInMs : null
        retry.error = (p && p.error) || null
        retry.exhausted = false
        break
      case 'download-exhausted':
        phase.value = 'download-failed'
        retry.exhausted = true
        retry.nextInMs = null
        failure.value = (p as FailureDescriptor) || null
        break
      case 'rolled-back':
        phase.value = 'rolled-back'
        break
      case 'rollback-failed':
        phase.value = 'rollback-failed'
        failure.value = (p as FailureDescriptor) || null
        break
    }
  }

  /* ── 动作（经宿主 SPI，不直接触 IPC）────────────────────────── */
  function installNow () {
    if (phase.value === 'install-blocked') {
      // 重试安装（重跑 preflight + 安装）
      if (host.supports('applyUpdate')) host.applyUpdate()
      return
    }
    if (host.supports('applyUpdate')) host.applyUpdate()
  }

  function setChannel (ch: UpdateChannel) {
    if (host.supports('setUpdateChannel')) host.setUpdateChannel(ch)
  }

  function manualRollback () {
    phase.value = 'rolling-back'
    if (host.supports('requestUpdateRollback')) host.requestUpdateRollback()
  }

  function retryDownload () {
    phase.value = 'downloading'
    retry.exhausted = false
    if (host.supports('retryDownloadNow')) host.retryDownloadNow()
  }

  /* 进度 / 发现 / 就绪 三事件（由 useHostSignals 转发，保持单一状态源） */
  function setProgress (pct: number | null) {
    progress.value = pct
    if (pct != null && phase.value === 'idle') phase.value = 'downloading'
  }
  function setAvailable (v: string) {
    availableVersion.value = v
    if (v) phase.value = 'downloading'
  }
  function setReady (v: string) {
    readyVersion.value = v
    progress.value = null
    phase.value = 'ready'
    dismissed.value = false
  }

  /* 首启就绪信号：App.vue onMounted 调一次 */
  function reportFirstLaunchReady () {
    if (host.supports('reportFirstLaunchReady')) host.reportFirstLaunchReady()
  }

  function dismiss () { dismissed.value = true }

  return {
    phase, status, progress, availableVersion, readyVersion, dismissed, failure, retry,
    refreshStatus, handleEvent, installNow, setChannel, manualRollback, retryDownload,
    setProgress, setAvailable, setReady, reportFirstLaunchReady, dismiss
  }
})
