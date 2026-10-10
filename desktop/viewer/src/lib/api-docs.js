/* ==========================================================================
 * API 视图 · 业务模块库 CRUD（纯函数，零 import，不可变返回新 docs）
 * 只存原始 Markdown，不存解析结果：体积更小，解析规则迭代后无需数据迁移。
 * docs = { seq:number, modules:[module] }
 * module = { id, name, fileName, size, importedAt, rev, md }
 * ========================================================================== */

export function emptyDocs () {
  return { seq: 1, modules: [] }
}

export function moduleOf (docs, id) {
  const list = (docs && docs.modules) || []
  for (const m of list) if (m.id === id) return m
  return null
}

function clone (docs) {
  return {
    seq: (docs && docs.seq) || 1,
    modules: ((docs && docs.modules) || []).map(m => Object.assign({}, m))
  }
}

/* 新增模块：返回 { docs, id } */
export function addModule (docs, input) {
  const d = clone(docs)
  const src = input || {}
  const id = 'm' + d.seq
  const m = {
    id,
    name: src.name || '未命名模块',
    fileName: src.fileName || '',
    size: src.size || 0,
    importedAt: src.importedAt || Date.now(),
    rev: 1,
    src: src.src || 'auto',
    md: String(src.md == null ? '' : src.md)
  }
  d.modules.push(m)
  d.seq += 1
  return { docs: d, id }
}

/* 批量导入：每个文件一个模块。files=[{name,size,text}] → { docs, ids } */
export function bulkAddFromFiles (docs, files, now) {
  let d = clone(docs)
  const ids = []
  const ts = now || Date.now()
  ;(files || []).forEach(f => {
    const r = addModule(d, {
      name: f.name,
      fileName: f.fileName || f.name || '',
      size: f.size || 0,
      md: f.text,
      src: f.src || 'auto',
      importedAt: ts
    })
    d = r.docs
    ids.push(r.id)
  })
  return { docs: d, ids }
}

export function renameModule (docs, id, name) {
  const d = clone(docs)
  const m = d.modules.filter(x => x.id === id)[0]
  if (!m) return d
  const n = String(name || '').trim()
  if (!n) return d
  m.name = n
  return d
}

export function removeModule (docs, id) {
  const d = clone(docs)
  d.modules = d.modules.filter(m => m.id !== id)
  return d
}

/* 重新导入覆盖：替换 md，保留 id 与用户自定义 name（rev+1 使解析缓存失效） */
export function replaceModuleMd (docs, id, md, fileName, size, now) {
  const d = clone(docs)
  const m = d.modules.filter(x => x.id === id)[0]
  if (!m) return d
  m.md = String(md == null ? '' : md)
  if (fileName) m.fileName = fileName
  if (size) m.size = size
  m.importedAt = now || Date.now()
  m.rev = (m.rev || 1) + 1
  return d
}

/* 追加导入：一个模块聚合多个导出文件 */
export function appendModuleMd (docs, id, md, now) {
  const d = clone(docs)
  const m = d.modules.filter(x => x.id === id)[0]
  if (!m) return d
  const add = String(md == null ? '' : md)
  m.md = (m.md ? m.md + '\n\n' : '') + add
  m.importedAt = now || Date.now()
  m.rev = (m.rev || 1) + 1
  return d
}

/* 备份合并：按 id 去重取新（备份文件里的数据为准），seq 取较大 */
export function mergeApiDocs (docs, incoming) {
  const d = clone(docs)
  const inc = (incoming && incoming.modules) || []
  if (!inc.length) return d
  const map = {}
  d.modules.forEach(m => { map[m.id] = m })
  inc.forEach(m => { if (m && m.id) map[m.id] = Object.assign({}, m) })
  d.modules = Object.keys(map).map(k => map[k])
  d.seq = Math.max(d.seq || 1, (incoming && incoming.seq) || 1)
  // 保证 seq 一定大于现存最大 id 序号，避免 id 冲突
  d.modules.forEach(m => {
    const n = parseInt(String(m.id).replace(/^m/, ''), 10)
    if (!isNaN(n) && n >= d.seq) d.seq = n + 1
  })
  return d
}

/* 统计：给导入预览/侧栏徽标用 */
export function statsOf (docs) {
  const list = (docs && docs.modules) || []
  let bytes = 0
  list.forEach(m => { bytes += String(m.md || '').length })
  return { modules: list.length, bytes }
}
