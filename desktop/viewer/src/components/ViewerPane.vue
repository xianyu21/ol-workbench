<template>
  <div class="viewport">
    <!-- 初始加载 / 连接失败 / 空状态 -->
    <div v-if="showBoot" class="loading-box">
      <div class="lb">
        <template v-if="store.loadError">
          <h2>{{ store.loadError }}</h2>
          <p class="sub">请确认本地服务已启动，且本页面是通过工作台窗口打开的。</p>
        </template>
        <template v-else-if="store.loaded">
          <h2>已读取「{{ store.rootName }}」</h2>
          <p class="sub">
            共 {{ store.projects.length }} 个页面。左侧按模块分组，点击任一页面即可在右侧预览。
          </p>
          <div class="note">
            <svg-icon name="info" :size="15" />
            <div>想用 AxHub 自带导航（左侧页面树 + 顶部工具栏）？点右上角「AxHub 导航」，会加载原生 index.html。本工作台额外提供多标签快速切换、搜索、标签分类。</div>
          </div>
        </template>
        <template v-else>
          <h2>正在连接本地服务…</h2>
          <p class="sub">同源加载 AxHub 导出数据，稍候。</p>
        </template>
      </div>
    </div>

    <!-- 需求2：iframe 同源加载；onload 后 bindFrameLinks 拦截页内链接联动 tab 栏 -->
    <div v-for="t in aliveTabs" :key="t.id + ':' + (t.rc || 0)" class="fwrap" :class="{ on: t.id === store.active }">
      <div v-if="t.loading" class="fload">
        <div class="txt">
          <div class="spin" />
          <b>正在加载「{{ titleOf(t) }}」</b>
          <div>首次加载后常驻内存，切换瞬间完成</div>
          <div class="path">{{ srcOf(getP(t.pid) || {}) }}</div>
        </div>
      </div>
      <iframe :src="srcOf(getP(t.pid) || {})" :title="titleOf(t)" allowfullscreen
        @load="onFrameLoad($event, t)" />
    </div>

    <!-- 休眠唤醒 -->
    <div v-if="sleepActive" class="wake">
      <div class="txt">
        <svg-icon name="box" :size="26" />
        <b>「{{ titleOf(sleepActive) }}」已休眠</b>
        <a-button type="primary" @click="wake(sleepActive)">重新加载</a-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { store, getP, srcOf, openProject, activeTab } from '../store.js'

const titleOf = t => { const p = getP(t.pid); return (p && p.name) || t.title }

/* LRU：仅渲染未休眠 tab 的 iframe；超 maxAlive 释放最久未用的未固定标签 */
const aliveTabs = computed(() => store.tabs.filter(t => !t.sleep))
const sleepActive = computed(() => {
  const t = activeTab.value
  return t && t.sleep ? t : null
})
const showBoot = computed(() =>
  store.loadError || !store.tabs.length || (!store.loaded && !store.serverOk)
)

function onFrameLoad (e, t) {
  t.loading = false
  try {
    const doc = e.target.contentDocument
    if (doc && doc.querySelectorAll) bindFrameLinks(e.target, doc)
  } catch (err) { /* 跨域等场景忽略 */ }
}

/* 需求2：拦截 iframe 内同源链接，命中其他页面则在本 tab 内切换并同步 tab 栏 */
function bindFrameLinks (f, doc) {
  let cur = null
  try { cur = new URL(f.src || location.href) } catch (e) {}
  doc.querySelectorAll('a[href]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href')
      if (!href) return
      if (a.target && a.target.toLowerCase() === '_blank') return  // 新窗口，不拦截
      if (href.charAt(0) === '#') return                            // 页内锚点，不拦截
      let abs
      try { abs = new URL(href, f.src || location.href) } catch (err) { return }
      if (abs.origin !== location.origin) return                    // 跨域，不拦截
      if (cur && abs.pathname === cur.pathname && abs.search === cur.search) return // 同页 hash 滚动
      let tgt = null
      for (const p of store.projects) {
        let pu
        try { pu = new URL(srcOf(p), location.href) } catch (err) { continue }
        if (pu.pathname === abs.pathname && pu.search === abs.search) { tgt = p; break }
      }
      if (tgt) { e.preventDefault(); openProject(tgt.id, false) }
    })
  })
}

/* LRU 保活管理：与旧版 lru() 行为一致（固定标签不释放，激活的不释放） */
function applyLru () {
  const max = Math.max(2, +store.settings.maxAlive || 8)
  const candidates = store.tabs
    .filter(t => !t.sleep && !t.pinned && t.id !== store.active)
    .sort((a, b) => (a.lastActive || 0) - (b.lastActive || 0))
  const alive = store.tabs.filter(t => !t.sleep).length
  let over = alive - max
  for (const t of candidates) {
    if (over <= 0) break
    t.sleep = true
    over--
  }
}
watch(() => [store.tabs.length, store.active, store.settings.maxAlive], applyLru, { immediate: true, deep: false })
watch(() => store.tabs.map(t => t.id + (t.sleep ? 's' : '')).join(','), () => {
  // 记录活跃时间：激活的 tab 每次切换刷新 lastActive
  const t = activeTab.value
  if (t) t.lastActive = Date.now()
})

function wake (t) { t.sleep = false; t.loading = true; t.lastActive = Date.now() }
</script>

<style scoped>
.viewport{flex:1 1 auto;position:relative;min-height:0;background:var(--bg);overflow:hidden}
.fwrap{position:absolute;inset:0;display:none;background:#fff}
.fwrap.on{display:block}
.fwrap iframe{width:100%;height:100%;border:0;display:block;background:#fff}
.fload{position:absolute;inset:0;display:grid;place-items:center;background:var(--panel);z-index:5;transition:opacity .2s}
.spin{width:26px;height:26px;border:2.5px solid var(--primary-soft-2);border-top-color:var(--primary);border-radius:50%;animation:sp .7s linear infinite;margin:0 auto 10px}
@keyframes sp{to{transform:rotate(360deg)}}
.fload .txt{text-align:center;color:var(--muted);font-size:13px}
.fload .txt b{display:block;color:var(--text-2);font-weight:600;margin-bottom:3px;font-size:13.5px}
.fload .path{font-size:11px;color:var(--muted);margin-top:6px;max-width:70vw;word-break:break-all;background:var(--panel-3);padding:4px 8px;border-radius:5px;display:inline-block}
.wake{position:absolute;inset:0;display:grid;place-items:center;background:var(--panel);z-index:6}
.wake .txt{text-align:center;color:var(--muted);font-size:13px;max-width:340px}
.wake .txt b{display:block;color:var(--text);font-size:14px;margin:8px 0 12px}
.wake .txt svg{color:var(--muted)}
.loading-box{position:absolute;inset:0;display:grid;place-items:start center;overflow:auto;padding:22px 18px;background:var(--panel);z-index:4}
.lb{max-width:520px;width:100%}
.lb h2{margin:0 0 6px;font-size:19px;font-weight:700;color:var(--text)}
.lb .sub{color:var(--text-2);margin:0 0 16px;font-size:13.5px;line-height:1.7}
.note{display:flex;gap:9px;padding:11px 13px;background:var(--warn-soft);border:1px solid #ffd9bd;border-radius:var(--r);font-size:12.5px;color:#8a4b12;line-height:1.65}
.note svg{flex:0 0 auto;color:var(--warn);margin-top:2px}
</style>
