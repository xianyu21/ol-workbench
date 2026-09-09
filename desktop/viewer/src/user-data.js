import UserKeys from '../../user-keys.js'

/* ==========================================================================
 * 用户数据持久化 module（渲染层唯一出入口）
 * interface：get(key, def) / set(key, value) / persist() / clear()
 * implementation：localStorage write-through 缓存 + 300ms 防抖整包回传
 * window.axhub.saveUserData 落盘；无桥接（浏览器 CLI 模式）自动退回纯 localStorage。
 * key 前缀与清单单源于 user-keys.js（preload require 同一份）。
 * ========================================================================== */

const K = UserKeys.PREFIX

export function get (key, def) {
  try { const v = localStorage.getItem(K + key); return v == null ? def : JSON.parse(v) } catch (e) { return def }
}

export function set (key, value) {
  try { localStorage.setItem(K + key, JSON.stringify(value)); return true } catch (e) { return false } finally { persist() }
}

/* 把当前已知 key 的 localStorage 值防抖回传磁盘（set 内部已调用；也供不写 key 的落盘场景用） */
let diskSaveTimer = null
export function persist () {
  if (!window.axhub || typeof window.axhub.saveUserData !== 'function') return
  if (diskSaveTimer) return
  diskSaveTimer = setTimeout(() => {
    diskSaveTimer = null
    try {
      const snap = {}
      for (const key of UserKeys.KEYS) {
        const full = K + key
        const raw = localStorage.getItem(full)
        if (raw == null) continue
        try { snap[full] = JSON.parse(raw) } catch (e) { snap[full] = raw }
      }
      window.axhub.saveUserData(snap)
    } catch (e) { /* 快照失败不影响运行 */ }
  }, 300)
}

/* 清空全部用户数据：localStorage 缓存 + 桌面端磁盘快照一并删除 */
export function clear () {
  try {
    Object.keys(localStorage).slice().forEach(k => { if (k.indexOf(K) === 0) localStorage.removeItem(k) })
  } catch (e) { /* ignore */ }
  if (window.axhub && typeof window.axhub.clearUserData === 'function') window.axhub.clearUserData()
}
