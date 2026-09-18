<template>
  <div class="vp-root">
    <!-- 面包屑：当前页面所在位置（项目 › 模块 › 页面），右侧可一键在侧栏定位 -->
    <div v-if="activeTab && !showBoot" class="crumbbar">
      <template v-for="(c, i) in crumbs" :key="i">
        <span v-if="i" class="cr-sep">›</span>
        <span class="cr-item" :class="{ last: i === crumbs.length - 1 }" :title="c">{{ c }}</span>
      </template>
      <span class="cr-sp" />
      <button class="cr-loc" title="在侧栏中定位 (展开侧栏并滚动到当前页)" @click="locateInSidebar">
        <svg-icon name="chev" :size="13" class="cr-loc-ic" />
      </button>
    </div>

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
      <div v-for="t in aliveTabs" :key="t.id + ':' + (t.rc || 0)" class="fwrap"
        :class="{ on: t.id === store.active, zoomed: effScale !== 1 }">
        <div v-if="t.loading" class="fload">
          <div class="txt">
            <div class="spin" />
            <b>正在加载「{{ titleOf(t) }}」</b>
            <div>首次加载后常驻内存，切换瞬间完成</div>
            <div class="path">{{ srcOf(getP(t.pid) || {}) }}</div>
          </div>
        </div>
        <iframe :src="frameSrc(t)" :title="titleOf(t)" allowfullscreen :style="frameStyle"
          @load="onFrameLoad($event, t)" />
      </div>

      <!-- 休眠唤醒 -->
      <div v-if="sleepActive" class="wake">
        <div class="txt">
          <svg-icon name="box" :size="26" />
          <b>「{{ titleOf(sleepActive) }}」已休眠</b>
          <a-button type="primary" @click="wakeTab(sleepActive.id)">重新加载</a-button>
        </div>
      </div>

      <!-- 缩放工具条：浮动在预览区右下角 -->
      <div v-if="activeTab && !showBoot" class="zoombar">
        <button v-for="z in ZOOMS" :key="z.v" class="zb-btn" :class="{ on: zoom === z.v }"
          :title="z.label" @click="setZoom(z.v)">{{ z.text }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import SvgIcon from './SvgIcon.vue'
import {
  store, getP, srcOf, openProject, activeTab,
  wakeTab, sweepLru, restoreSessionTabs, markLoaded, retargetTab
} from '../store.js'
import { matchPageByUrl } from '../tabs.js'
import * as userData from '../user-data.js'
import { isDark } from '../theme.js'

const titleOf = t => { const p = getP(t.pid); return (p && p.name) || t.title }

/* ---------- 面包屑：项目 › 模块 › 页面 ---------- */
const crumbs = computed(() => {
  const t = activeTab.value
  if (!t) return []
  const p = getP(t.pid)
  if (!p) return []
  const arr = []
  if (!p.native && store.rootName) arr.push(store.rootName)
  if (p.group) arr.push(p.group)
  arr.push(p.name)
  return arr
})

/* 在侧栏中定位：侧栏收起时先展开（restoreSidebar 会恢复固定宽度），再滚动到当前项 */
function locateInSidebar () {
  if (store.settings.collapsed) window.dispatchEvent(new Event('ax-restore-sidebar'))
  // active 未变时 Sidebar 的 watch 不触发，这里显式发定位事件
  window.dispatchEvent(new Event('ax-locate-sidebar'))
}

/* ---------- 预览缩放：transform scale 实现，'fit' 按内容自然宽度适应容器 ---------- */
const ZOOMS = [
  { v: 0.5, text: '50%', label: '缩放 50%' },
  { v: 0.75, text: '75%', label: '缩放 75%' },
  { v: 1, text: '100%', label: '缩放 100%' },
  { v: 'fit', text: '适应', label: '适应宽度（按页面自然宽度缩放）' }
]
const zoom = ref(userData.get('zoom', 1))
function setZoom (v) {
  zoom.value = v
  userData.set('zoom', v) // set 内部已触发防抖落盘
  if (v === 'fit') nextTick(measureFit)
}

/* fit：读取激活 iframe 内容的自然宽度（Axure 页面通常是固定宽），缩放比 = 容器宽 / 自然宽 */
const fitScale = ref(1)
function measureFit () {
  if (zoom.value !== 'fit') return
  const wrap = document.querySelector('.fwrap.on')
  const f = wrap && wrap.querySelector('iframe')
  if (!wrap || !f) { fitScale.value = 1; return }
  let naturalW = 0
  try {
    const doc = f.contentDocument
    if (doc && doc.documentElement) {
      naturalW = Math.max(doc.documentElement.scrollWidth, doc.body ? doc.body.scrollWidth : 0)
    }
  } catch (e) { naturalW = 0 } // 跨域等场景放弃适应
  const cw = wrap.clientWidth
  fitScale.value = naturalW > 0 && cw > 0 && naturalW > cw
    ? Math.max(0.25, Math.min(1, Math.round((cw / naturalW) * 100) / 100))
    : 1
}

const effScale = computed(() => (zoom.value === 'fit' ? fitScale.value : +zoom.value) || 1)

/* iframe 缩放样式：先放大布局尺寸再 scale 缩回，超出部分由 .fwrap.on.zoomed 滚动 */
const frameStyle = computed(() => {
  const s = effScale.value
  if (s === 1) return null
  return {
    width: (100 / s) + '%',
    height: (100 / s) + '%',
    transform: 'scale(' + s + ')',
    transformOrigin: '0 0'
  }
})

/* fit 相关的重算时机：窗口缩放 / 切换标签 */
function onWinResize () { measureFit() }
onMounted(() => window.addEventListener('resize', onWinResize))
onBeforeUnmount(() => window.removeEventListener('resize', onWinResize))
watch(() => store.active, () => nextTick(() => setTimeout(measureFit, 200)))

/* iframe 实际加载地址：优先用 t.src 快照（iframe 自导航重指向标签时保持快照不变，
 * 避免 src 属性变化触发二次加载），常规创建/唤醒/刷新时为空 → 回退到当前 pid 计算值 */
function frameSrc (t) { return t.src || srcOf(getP(t.pid) || {}) }

/* LRU：仅渲染未休眠 tab 的 iframe；超 maxAlive 的逐出决策在 tabs.js（lruSweep） */
const aliveTabs = computed(() => store.tabs.filter(t => !t.sleep))
const sleepActive = computed(() => {
  const t = activeTab.value
  return t && t.sleep ? t : null
})
const showBoot = computed(() =>
  store.loadError || !store.tabs.length || (!store.loaded && !store.serverOk)
)

function onFrameLoad (e, t) {
  markLoaded(t.id)
  try {
    const doc = e.target.contentDocument
    if (doc && doc.querySelectorAll) bindFrameLinks(e.target, doc)
    syncSelfNav(e.target, t)
    injectIframeStyle(doc, effScale.value !== 1) // 让 iframe 内滚动条变细，缩放时禁用内层滚动避免与外層叠双
  } catch (err) { /* 跨域等场景忽略 */ }
  if (zoom.value === 'fit' && t.id === store.active) setTimeout(measureFit, 150)
}

/* 向同源预览 iframe 注入滚动条样式（iframe 的滚动条不受父页面 CSS 影响，需注入到其文档）。
 * 缩放态下禁用 iframe 文档级滚动，整页滚动统一交给外层 .fwrap.on.zoomed，避免双层滚动条。 */
function injectIframeStyle (doc, zoomed) {
  if (!doc || !doc.head) return
  let st = doc.getElementById('__axhub_viewer_style')
  if (!st) {
    st = doc.createElement('style')
    st.id = '__axhub_viewer_style'
    doc.head.appendChild(st)
  }
  const scheme = isDark.value ? 'dark' : 'light'
  // iframe 是独立文档，滚动条变量需显式注入，才能与外壳(外壳用 :root)保持同一套主题色
  const vars = isDark.value
    ? '--scroll-thumb:#3a455c;--scroll-thumb-hover:#4d5a76'
    : '--scroll-thumb:#ccd3dc;--scroll-thumb-hover:#aeb8c6'
  st.textContent =
    'html{' + vars + ';color-scheme:' + scheme + ';scrollbar-width:thin;scrollbar-color:var(--scroll-thumb) transparent}\n' +
    '::-webkit-scrollbar{width:8px;height:8px}\n' +
    '::-webkit-scrollbar-track{background:transparent}\n' +
    '::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border-radius:8px;border:2px solid transparent;background-clip:content-box}\n' +
    '::-webkit-scrollbar-thumb:hover{background:var(--scroll-thumb-hover);background-clip:content-box}\n' +
    (zoomed ? 'html,body{overflow:hidden !important}\n' : '')
}
/* 缩放 / 主题变化时同步刷新当前激活 iframe 的注入样式 */
function injectActive () {
  const f = document.querySelector('.fwrap.on iframe')
  if (!f) return
  try { injectIframeStyle(f.contentDocument, effScale.value !== 1) } catch (e) { /* 跨域忽略 */ }
}
watch(effScale, injectActive)
watch(isDark, injectActive)

/* iframe 自行跳转（Axure 式 JS location 跳转 / meta refresh / 表单）：
 * load 后比对当前文档地址，命中已收录页面则把标签重指向新页（含 openCount/最近访问），
 * 但不改 src 快照 → iframe 不重载，标签栏/侧栏联动照常 */
function syncSelfNav (f, t) {
  let from, now
  try { from = new URL(f.src || location.href) } catch (e) { return }
  try { now = new URL(f.contentWindow.location.href) } catch (e) { return }
  if (now.origin !== location.origin) return
  if (from.pathname === now.pathname && from.search === now.search) return
  const hit = matchPageByUrl(store.projects, now.pathname, now.search, location.href)
  if (hit) retargetTab(t.id, hit)
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
      const tgt = matchPageByUrl(store.projects, abs.pathname, abs.search, f.src || location.href)
      if (tgt) { e.preventDefault(); openProject(tgt.id, false) }
    })
  })
}

/* LRU 逐出：只保留对 settings/标签集合的响应式触发，决策在 tabs.js */
watch(() => [store.tabs.length, store.active, store.settings.maxAlive], sweepLru, { immediate: true, deep: false })

/* 会话恢复懒加载：启动时恢复的标签只保留激活项立即加载（只发起 1 个页面请求），
 * 其余休眠、首次点击唤醒。仅本组件挂载时执行一次，不影响会话中新开的标签。 */
onMounted(() => { restoreSessionTabs() })
</script>

<style scoped>
.vp-root{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;min-height:0}
/* 面包屑条 */
.crumbbar{flex:0 0 auto;height:28px;display:flex;align-items:center;gap:7px;padding:0 12px;font-size:12px;background:var(--panel-2);border-bottom:1px solid var(--border-2);color:var(--muted);min-width:0}
.cr-item{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cr-item.last{color:var(--text);font-weight:600}
.cr-sep{color:var(--muted);opacity:.7;flex:0 0 auto}
.cr-sp{flex:1 1 auto}
.cr-loc{flex:0 0 auto;width:22px;height:22px;border-radius:5px;display:grid;place-items:center;color:var(--muted);background:none;border:none;cursor:pointer}
.cr-loc:hover{background:var(--hover);color:var(--primary)}
.cr-loc-ic{transform:rotate(-90deg)}
.viewport{flex:1 1 auto;position:relative;min-height:0;background:var(--bg);overflow:hidden}
.fwrap{position:absolute;inset:0;display:none;background:var(--frame-bg)}
.fwrap.on{display:block}
.fwrap.on.zoomed{overflow:auto;background:var(--bg)}  /* 缩放后周围露出工作台底色并允许滚动 */
.fwrap iframe{width:100%;height:100%;border:0;display:block;background:var(--frame-bg)}
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
.note{display:flex;gap:9px;padding:11px 13px;background:var(--warn-soft);border:1px solid var(--warn-border);border-radius:var(--r);font-size:12.5px;color:var(--warn-text);line-height:1.65}
.note svg{flex:0 0 auto;color:var(--warn);margin-top:2px}
/* 缩放工具条：右下角浮动胶囊 */
.zoombar{position:absolute;right:14px;bottom:14px;z-index:7;display:flex;gap:1px;padding:3px;border-radius:9px;background:var(--panel);border:1px solid var(--border);box-shadow:var(--sh-2)}
.zb-btn{height:24px;padding:0 9px;border-radius:6px;font-size:11.5px;color:var(--text-2);background:none;border:none;cursor:pointer;white-space:nowrap}
.zb-btn:hover{background:var(--hover);color:var(--text)}
.zb-btn.on{background:var(--primary-soft);color:var(--primary-2);font-weight:650}
</style>
