<template>
  <div class="sec">
    <div class="sec-h" :class="{ closed: isClosed }" :style="{ paddingLeft: (8 + node.depth * 14) + 'px' }" @click="toggle">
      <svg-icon name="chev" :size="13" class="chev" />
      <svg-icon :name="node.icon" :size="13" />
      <span class="sec-t">{{ node.title }}</span>
      <span class="cnt">{{ node.items.length }}</span>
    </div>
    <div v-if="!isClosed" class="sec-body">
      <div v-for="p in node.items" :key="p.id" class="item" :data-p="p.id"
        :class="{ active: isActive(p.id) }" :title="p.path"
        @click="open(p.id)" @contextmenu.prevent="menu($event, p)">
        <span class="it-body">
          <span class="it-name">
            <span v-html="hi(p.sname || p.name)"></span>
            <span v-if="p.native" class="badge-ax">框架</span>
            <svg-icon v-if="p.fav" name="star" :size="11" fill class="fav-star" />
          </span>
          <span class="it-meta">
            <span v-for="t in (p.tags || []).slice(0, 2)" :key="t" class="tg">
              <i :style="{ background: tagColor(t) }" />{{ t }}
            </span>
            <template v-if="metaOf(p).length">
              <span v-if="(p.tags || []).length">·</span>
              <span>{{ metaOf(p).join(' · ') }}</span>
            </template>
          </span>
        </span>
        <span class="it-act">
          <button :class="{ fav: p.fav }" title="收藏" @click.stop="toggleFav(p)">
            <svg-icon name="star" :size="14" :fill="!!p.fav" />
          </button>
          <button title="更多" @click.stop="menuAt($event, p)">
            <svg-icon name="menu" :size="14" />
          </button>
        </span>
      </div>
      <SectionNode v-for="c in node.children" :key="c.key" :node="c" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Modal, message } from 'ant-design-vue'
import SvgIcon from './SvgIcon.vue'

import { store, openProject, tabOf, persist, tagColor } from '../store.js'
import { showCtx } from '../ctx.js'
import { ui } from '../ui.js'

const props = defineProps({ node: { type: Object, required: true } })

const isClosed = computed(() => !!store.secClosed[props.node.key])
function toggle () { store.secClosed[props.node.key] = !store.secClosed[props.node.key]; persist() }

const isActive = pid => { const t = tabOf(pid); return t && t.id === store.active }
const metaOf = p => {
  const m = []
  if (p.lastOpen) m.push('最近')
  if (p.native) m.push('AxHub 框架')
  return m
}
function hi (text) {
  const q = store.q.trim()
  if (!q) return esc(text)
  let out = esc(text)
  q.split(/\s+/).forEach(w => {
    if (!w) return
    const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')
    out = out.replace(re, '<mark>$1</mark>')
  })
  return out
}
function esc (s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
function toggleFav (p) { p.fav = p.fav ? 0 : 1; persist() }

function buildMenu (p) {
  return [
    { header: p.name },
    { key: 'open', label: '在当前标签打开', icon: 'folder', act: () => openProject(p.id, false) },
    { key: 'newtab', label: '在新标签打开', icon: 'plus', act: () => openProject(p.id, true) },
    { key: 'newwin', label: '在新窗口打开', icon: 'ext', act: () => openExternal(p) },
    { divider: true },
    { key: 'fav', label: p.fav ? '取消收藏' : '收藏置顶', icon: 'star', act: () => toggleFav(p) },
    { key: 'tags', label: '编辑标签分类', icon: 'tag', act: () => { ui.editTagsPid = p.id } },
    { key: 'rename', label: '重命名显示名', icon: 'edit', act: () => { ui.renamePid = p.id } },
    { key: 'copy', label: '复制文件名', icon: 'copy', act: () => copyText(p.path) },
    { divider: true },
    { key: 'remove', label: '从列表移除', icon: 'trash', danger: true, act: () => confirmRemove(p) }
  ]
}
function menu (e, p) { showCtx(e.clientX, e.clientY, buildMenu(p)) }
function menuAt (e, p) {
  const r = e.currentTarget.getBoundingClientRect()
  showCtx(r.left, r.bottom + 4, buildMenu(p))
}
function open (pid) { openProject(pid, false) }
function openExternal (p) {
  const w = window.open('/' + encodeURIComponent(p.path), '_blank')
  if (!w) message.error('浏览器拦截了新窗口')
}
function copyText (t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(() => message.success('已复制：' + t), () => fallbackCopy(t))
  } else fallbackCopy(t)
}
function fallbackCopy (t) {
  const ta = document.createElement('textarea')
  ta.value = t; ta.style.cssText = 'position:fixed;left:-9999px'
  document.body.appendChild(ta); ta.select()
  try { document.execCommand('copy'); message.success('已复制') } catch (e) { message.error('复制失败') }
  ta.remove()
}
function confirmRemove (p) {
  Modal.confirm({
    title: '移除页面',
    content: `从工作台列表移除「${p.name}」。只删列表记录（含标签），不会删除磁盘上的 AxHub 文件。重新扫描可加回。`,
    okText: '移除', okType: 'danger', cancelText: '取消',
    onOk () {
      const t = tabOf(p.id)
      if (t) store.tabs = store.tabs.filter(x => x.id !== t.id)
      store.projects = store.projects.filter(x => x.id !== p.id)
      if (store.active && !store.tabs.some(x => x.id === store.active)) store.active = store.tabs.length ? store.tabs[0].id : null
      persist()
      message.success('已移除')
    }
  })
}
</script>

<style scoped>
.sec{min-width:0}
.sec-h{display:flex;align-items:center;gap:6px;padding:9px 6px 6px;font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.7px;text-transform:uppercase;user-select:none;cursor:pointer}
.sec-h .chev{transition:transform .15s;flex:0 0 auto}
.sec-h.closed .chev{transform:rotate(-90deg)}
.sec-h .sec-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sec-h .cnt{margin-left:auto;font-weight:600;letter-spacing:0;font-size:11px;background:var(--panel-3);padding:1px 6px;border-radius:9px;text-transform:none}
.sec-body{min-width:0}
.item{display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:var(--r-sm);cursor:pointer;position:relative;transition:background .1s;margin-bottom:1px}
.item:hover{background:var(--panel-3)}
.item.active{background:var(--primary-soft)}
.item.active .it-name{color:var(--primary-2);font-weight:650}
.it-body{flex:1 1 auto;min-width:0}
.it-name{font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:5px}
.it-name mark{background:#ffe58f;color:#1f2b3d;border-radius:2px;padding:0 1px}
.fav-star{color:var(--warn)}
.badge-ax{font-size:10px;font-weight:600;color:var(--primary-2);background:var(--primary-soft);padding:0 5px;border-radius:4px;flex:0 0 auto}
.it-meta{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;margin-top:1px}
.it-meta .tg{display:inline-flex;align-items:center;gap:3px}
.it-meta .tg i{width:6px;height:6px;border-radius:50%;display:inline-block}
.it-act{flex:0 0 auto;display:flex;gap:1px;opacity:0;transition:opacity .12s}
.item:hover .it-act,.item.active .it-act{opacity:1}
.it-act button{width:26px;height:26px;border-radius:6px;display:grid;place-items:center;color:var(--muted);cursor:pointer}
.it-act button:hover{background:rgba(31,43,61,.09);color:var(--text)}
.it-act button.fav{color:var(--warn)}
</style>

