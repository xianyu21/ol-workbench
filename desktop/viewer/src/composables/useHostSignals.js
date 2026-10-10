import { ref, onMounted } from 'vue'
import { host } from '@/host/index.js'

/* ==========================================================================
 * 宿主信号：关闭行为询问 + 后台更新进度
 * 全部经宿主语义接口订阅，组件不感知桌面壳的存在。
 * ========================================================================== */
export function useHostSignals () {
  const closeAsk = ref(false)
  const closeRemember = ref(false)
  const updatePct = ref(null)   // null = 未在下载
  const updateVer = ref('')
  const readyVer = ref('')
  const updateReady = ref(false)

  function applyClose (action) {
    host.answerExitRequest(action, closeRemember.value)
    closeAsk.value = false
  }
  function installNow () { if (host.supports('applyUpdate')) host.applyUpdate() }

  onMounted(() => {
    host.onExitRequest(() => { closeAsk.value = true })
    host.onDownloadProgress(pct => { updatePct.value = pct })
    host.onUpdateFound(info => { updateVer.value = (info && info.version) || '' })
    // 下载完成：提示立即重启；不点则退出应用时自动安装（主进程 autoInstallOnAppQuit）
    host.onUpdateStaged(info => {
      updateReady.value = true
      readyVer.value = (info && info.version) || updateVer.value
      updatePct.value = null
    })
  })

  return { closeAsk, closeRemember, updatePct, updateVer, readyVer, updateReady, applyClose, installNow }
}
