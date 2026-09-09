/* ==========================================================================
 * 标签页生命周期纯函数 module —— 零 import（不碰 vue/reactive），node:test 可直接动态 import。
 * 约定（不可变风格）：
 *   - 函数吃普通对象状态 model = { tabs, active, tabSeq }（tabSeq 形如 {n}），
 *     返回「需要更新的字段」组成的新对象：{ tabs?, active?, tabSeq? }；
 *     无变化时返回 null，调用方跳过赋值。
 *   - 不修改入参；变更的 tab 生成新对象，未变更的保持引用。
 *   - invariant「激活标签永不休眠」由 setActive / lruSweep / restoreSession 构造保证，
 *     不依赖调用方纪律（旧版靠 ViewerPane 安全网 watcher 兜底）。
 *   - 时间戳统一由 now 参数注入，保证可测性。
 * 页面 URL 词汇（enc/srcOf/matchPageByUrl）也在这里：它是自导航/链接拦截匹配的
 * 共同依赖，且必须保持零 import。
 * ========================================================================== */

/* 生成 tab 的新对象；字段值为 undefined 表示删除该字段（如 src 快照） */
function patch (t, fields) {
  const out = Object.assign({}, t)
  for (const k in fields) {
    if (fields[k] === undefined) delete out[k]
    else out[k] = fields[k]
  }
  return out
}

function mapById (tabs, id, fn) {
  let hit = false
  const out = tabs.map(t => {
    if (t.id !== id) return t
    hit = true
    return fn(t)
  })
  return hit ? out : null
}

/* ---------- 页面 URL 词汇（与旧版 store.enc/srcOf 行为一致） ---------- */
export function enc (p) { return '/' + encodeURIComponent(p) }
export function srcOf (p) { return p && p.native ? '/index.html' : enc(p.path) }

/* URL → 页面匹配：pathname+search 与某页面 src 一致即命中（bindFrameLinks 与自导航共用） */
export function matchPageByUrl (projects, pathname, search, baseHref) {
  for (const p of projects) {
    let pu
    try { pu = new URL(srcOf(p), baseHref) } catch (e) { continue }
    if (pu.pathname === pathname && pu.search === search) return p
  }
  return null
}

/* ---------- 生命周期动词 ---------- */

/* 打开页面：已有标签即激活（休眠则唤醒）；否则复用未固定的当前标签（浏览器式替换）；
 * forceNew 强制新开。 */
export function open (model, page, opts = {}) {
  const now = opts.now || 0
  const ex = model.tabs.find(t => t.pid === page.id)
  if (ex && !opts.forceNew) {
    const out = mapById(model.tabs, ex.id, t => patch(t, {
      sleep: false, loading: t.sleep ? true : t.loading, lastActive: now
    }))
    return { tabs: out, active: ex.id, tabSeq: model.tabSeq }
  }
  const cur = model.tabs.find(t => t.id === model.active)
  if (!opts.forceNew && cur && !cur.pinned) {
    const out = mapById(model.tabs, cur.id, t => patch(t, {
      pid: page.id, title: page.name, native: !!page.native,
      sleep: false, loading: true, lastActive: now, src: undefined
    }))
    return { tabs: out, active: cur.id, tabSeq: model.tabSeq }
  }
  const t = {
    id: 't' + model.tabSeq.n, pid: page.id, pinned: false, title: page.name,
    native: !!page.native, sleep: false, loading: true, lastActive: now
  }
  return {
    tabs: model.tabs.concat([t]),
    active: t.id,
    tabSeq: { n: model.tabSeq.n + 1 }
  }
}

/* 激活标签；目标在休眠态则一并唤醒（invariant 保证点之一） */
export function setActive (model, id, now = 0) {
  if (model.active === id) return null
  const tabs = mapById(model.tabs, id, t => patch(t, {
    sleep: false, loading: t.sleep ? true : t.loading, lastActive: now
  }))
  if (!tabs) return null
  return { tabs, active: id }
}

/* 唤醒（休眠遮罩按钮用）：目标就是激活项，setActive 会因 active===id 短路，单独提供 */
export function wake (model, id, now = 0) {
  const tabs = mapById(model.tabs, id, t => patch(t, { sleep: false, loading: true, lastActive: now }))
  return tabs ? { tabs } : null
}

/* 关闭标签：关闭激活项时激活转移到相邻标签（与旧版索引行为一致） */
export function close (model, id) {
  const idx = model.tabs.findIndex(t => t.id === id)
  if (idx < 0) return null
  const tabs = model.tabs.filter(t => t.id !== id)
  let active = model.active
  if (active === id) active = tabs.length ? tabs[Math.max(0, idx - 1)].id : null
  return { tabs, active }
}

export function togglePin (model, id) {
  const flipped = mapById(model.tabs, id, t => patch(t, { pinned: !t.pinned }))
  if (!flipped) return null
  return { tabs: flipped.filter(t => t.pinned).concat(flipped.filter(t => !t.pinned)) }
}

/* 刷新：rc 递增（ViewerPane 以 :key 含 rc 重建 iframe）、清 src 快照、置 loading */
export function reload (model, id) {
  const tabs = mapById(model.tabs, id, t => patch(t, { rc: (t.rc || 0) + 1, loading: true, src: undefined }))
  return tabs ? { tabs } : null
}

/* iframe onload：清除 loading */
export function markLoaded (model, id) {
  const tabs = mapById(model.tabs, id, t => patch(t, { loading: false }))
  return tabs ? { tabs } : null
}

/* iframe 自导航重指向：命中已收录页面时改标签的 pid/title/native（src 快照不动 → 不重载） */
export function retargetSelfNav (model, id, page) {
  const tabs = mapById(model.tabs, id, t => patch(t, { pid: page.id, title: page.name, native: !!page.native }))
  return tabs ? { tabs } : null
}

/* 页面重命名后同步相关标签标题 */
export function renameSync (model, pid, title) {
  let hit = false
  const tabs = model.tabs.map(t => {
    if (t.pid !== pid) return t
    hit = true
    return patch(t, { title })
  })
  return hit ? { tabs } : null
}

/* LRU 保活：超过 maxAlive 时休眠最久未用的未固定非激活项。激活项永不入眠（invariant 保证点之二） */
export function lruSweep (model, maxAlive) {
  const max = Math.max(2, +maxAlive || 8)
  const alive = model.tabs.filter(t => !t.sleep).length
  let over = alive - max
  if (over <= 0) return null
  const victims = model.tabs
    .filter(t => !t.sleep && !t.pinned && t.id !== model.active)
    .sort((a, b) => (a.lastActive || 0) - (b.lastActive || 0))
    .slice(0, over)
    .map(t => t.id)
  if (!victims.length) return null
  const set = new Set(victims)
  let changed = false
  const tabs = model.tabs.map(t => {
    if (!set.has(t.id)) return t
    changed = true
    return patch(t, { sleep: true, src: undefined }) // 休眠即销毁 iframe，唤醒时按当前 pid 重新加载
  })
  return changed ? { tabs } : null
}

/* 会话恢复懒加载：除激活项外全部休眠，首次点击再唤醒（invariant 保证点之三） */
export function restoreSession (model) {
  let changed = false
  const tabs = model.tabs.map(t => {
    if (t.sleep || t.id === model.active) return t
    changed = true
    return patch(t, { sleep: true, src: undefined })
  })
  return changed ? { tabs } : null
}

/* 批量关闭：逐个 close 折叠激活转移，语义与逐次点关闭一致 */
export function closeOthers (model, keep) {
  let m = { tabs: model.tabs, active: model.active }
  for (const t of model.tabs.slice()) {
    if (t.id === keep || t.pinned) continue
    const r = close(m, t.id)
    if (r) m = { tabs: r.tabs, active: r.active }
  }
  return m.tabs === model.tabs && m.active === model.active ? null : m
}

export function closeAllUnpinned (model) {
  let m = { tabs: model.tabs, active: model.active }
  for (const t of model.tabs.slice()) {
    if (t.pinned) continue
    const r = close(m, t.id)
    if (r) m = { tabs: r.tabs, active: r.active }
  }
  return m.tabs === model.tabs && m.active === model.active ? null : m
}

/* 清理指向已不存在页面（pid 不满足 keep）的标签；激活项被清时转移到第一个标签
 * （与旧版 mergeTree 行为一致）。keep(pid) → boolean 由调用方注入。 */
export function pruneTabs (model, keep) {
  const tabs = model.tabs.filter(t => keep(t.pid))
  let active = model.active
  if (active && !tabs.some(t => t.id === active)) active = tabs.length ? tabs[0].id : null
  if (tabs.length === model.tabs.length && active === model.active) return null
  return { tabs, active }
}
