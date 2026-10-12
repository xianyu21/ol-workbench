import { ref, onMounted } from 'vue'
import { host } from '@/host/index.js'
import { useUpdateStore } from '@/stores/update'

/* ==========================================================================
 * 宿主信号：关闭行为询问 + 后台更新进度 / 状态机事件。
 * 全部经宿主语义接口（SPI）订阅，组件不感知桌面壳的存在。
 * 更新相关信号统一汇入 update store（单一状态源），由 UpdateCard 展示。
 * ========================================================================== */
export function useHostSignals () {
  const closeAsk = ref(false)
  const closeRemember = ref(false)
  const update = useUpdateStore()

  function applyClose (action: string) {
    host.answerExitRequest(action, closeRemember.value)
    closeAsk.value = false
  }

  onMounted(() => {
    host.onExitRequest(() => { closeAsk.value = true })

    // 既有下载/发现/就绪事件 → 汇入更新状态机
    host.onDownloadProgress((pct: number | null) => { update.setProgress(pct) })
    host.onUpdateFound((info: { version: string }) => { update.setAvailable((info && info.version) || '') })
    host.onUpdateStaged((info: { version: string }) => { update.setReady((info && info.version) || '') })

    // 更新增强 P0：多路复用事件（渠道/拦截/失败/重试/回滚…）
    host.onUpdateEvent((ev: any) => { update.handleEvent(ev) })
  })

  return { closeAsk, closeRemember, applyClose }
}
