/* ==========================================================================
 * 收藏库合并纯函数 —— 零 import（不碰 vue），node:test 可直接动态 import。
 * 覆盖两条历史泄漏：备份导入的合并算法（曾锁死在 BackupModal.vue）与
 * 扫描结果合并 mergeTree（曾锁死在 store.js）。不可变风格：不改入参。
 * ========================================================================== */

/* 备份合并：同一页面（按 id）取双方标注的并集/较大值，重命名优先；
 * 新页面直接追加到尾部。返回 { projects, add, updated }。 */
export function mergeProjects (current, incoming) {
  const byId = {}
  current.forEach(p => { byId[p.id] = p })
  let add = 0, updated = 0
  const projects = current.slice()
  incoming.forEach(np => {
    const old = byId[np.id]
    if (!old) { add++; projects.push(np); return }
    updated++
    const idx = projects.indexOf(old)
    projects[idx] = {
      ...old,
      tags: Array.from(new Set((old.tags || []).concat(np.tags || []))),
      cover: (np.cover && !old.cover) ? np.cover : old.cover,
      name: np.renamed ? np.name : old.name,
      renamed: np.renamed ? 1 : (old.renamed || 0),
      fav: old.fav || np.fav || 0,
      openCount: Math.max(old.openCount || 0, np.openCount || 0),
      lastOpen: Math.max(old.lastOpen || 0, np.lastOpen || 0)
    }
  })
  return { projects, add, updated }
}

/* 标签定义合并：按 name 去重（先到先得，保留既有颜色） */
export function mergeTags (current, incoming) {
  const out = current.slice()
  incoming.forEach(t => { if (!out.some(x => x.name === t.name)) out.push(t) })
  return out
}

/* 扫描结果合并：磁盘/前端扫描的页面清单重建 projects，本地标注（收藏/标签/重命名等）
 * 按路径保留。now 注入新增页面的 addedAt，保证纯函数可测。 */
export function mergeScannedPages (current, pages, now = 0) {
  const local = {}
  current.forEach(p => { if (p.path) local[p.path] = p })
  return {
    projects: pages.map(p => {
      const l = local[p.path] || {}
      return {
        id: p.id, name: l.renamed ? l.name : p.name, path: p.path, group: p.group, size: p.size,
        tags: l.tags || [], fav: l.fav || 0, cover: l.cover || null, renamed: l.renamed || 0,
        openCount: l.openCount || 0, lastOpen: l.lastOpen || 0, addedAt: l.addedAt || now
      }
    })
  }
}
