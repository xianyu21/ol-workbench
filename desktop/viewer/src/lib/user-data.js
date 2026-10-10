import UserKeys from '../../../user-keys.js'
import { host } from '@/host/index.js'

/* ==========================================================================
 * 用户数据持久化 module（渲染层唯一出入口）
 * interface：get(key, def) / set(key, value) / readSnapshot(fullKey) / persist() / clear()
 * implementation：同源缓存（localStorage write-through）+ 300ms 防抖整包归档
 * 归档动作经宿主语义接口 host.archiveSnapshot / host.discardSnapshot —— 本 module
 * 对「桌面壳磁盘 / 纯浏览器（无磁盘）」零知识；无归档能力的宿主按契约静默跳过。
 * key 前缀与清单单源于 user-keys.js（preload require 同一份）。
 * ========================================================================== */

const K = UserKeys.PREFIX

export function get (key, def) {
  try { const v = localStorage.getItem(K + key); return v == null ? def : JSON.parse(v) } catch (e) { return def }
}

export function set (key, value) {
  try { localStorage.setItem(K + key, JSON.stringify(value)); return true } catch (e) { return false } finally { persist() }
}

/* 按 user-keys.js 的清单读取当前全部持久化条目（新增持久化字段自动纳入，无需改调用方）。
 * fullKey=true  → 宿主归档用原始键名（含前缀，与 preload 灌回缓存的格式一致）
 * fullKey=false → 业务键名（备份导出/导入用，跨版本可读）
 * 这是持久层的唯一读出口：业务层（含备份弹窗）禁止直调 localStorage。 */
export function readSnapshot (fullKey) {
  const snap = {}
  for (const key of UserKeys.KEYS) {
    const raw = localStorage.getItem(K + key)
    if (raw == null) continue
    const name = fullKey ? K + key : key
    try { snap[name] = JSON.parse(raw) } catch (e) { snap[name] = raw }
  }
  return snap
}

/* 把当前已知 key 的同源缓存值防抖归档到宿主（set 内部已调用；也供不写 key 的归档场景用） */
let diskSaveTimer = null
export function persist () {
  if (!host.supports('archiveSnapshot')) return
  if (diskSaveTimer) return
  diskSaveTimer = setTimeout(() => {
    diskSaveTimer = null
    try { host.archiveSnapshot(readSnapshot(true)).catch(() => { /* 归档失败不影响运行 */ }) } catch (e) { /* ignore */ }
  }, 300)
}

/* 清空全部用户数据：同源缓存 + 宿主磁盘快照一并删除 */
export function clear () {
  try {
    Object.keys(localStorage).slice().forEach(k => { if (k.indexOf(K) === 0) localStorage.removeItem(k) })
  } catch (e) { /* ignore */ }
  if (host.supports('discardSnapshot')) host.discardSnapshot().catch(() => { /* ignore */ })
}
