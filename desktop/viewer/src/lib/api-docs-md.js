/* ==========================================================================
 * API 视图 · Markdown 接口文档解析（Apifox / Apipost 导出）
 * 零 import 纯函数：node --test 可直接 await import() 单测，浏览器同构。
 * 不引入 marked / markdown-it——只解析接口文档需要的四种块：标题、表格、
 * 代码块、文本，其余原样保留。
 *
 * 两种导出格式差异全部收敛到下方「规则表」常量，拿到真实样例后只改这里。
 * 契约：任何输入都不抛错；解析不出接口时返回 endpoints:[] + warnings + raw。
 *
 * 已验证的真实格式：
 *   Apifox : 「# 分组」→「## METHOD 名称」+ 独立「METHOD /path」行 + 「### 请求参数」
 *            （表头 名称|位置|类型|必选|说明）+「> 返回示例 / > 200 Response」+ ```json
 *   Apipost: 「# 分组」→「## 名称」+「**请求方式**」/「**接口URL**」加粗标签 +
 *            「> POST」/「> {{host}}/path」引用块 + 「**请求Header参数**」等加粗分节
 *            （表头 参数名|示例值|参数类型|是否必填|参数描述）+「**响应示例**」代码块
 * ========================================================================== */

export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
const METHOD_RE = new RegExp('^(?:' + METHODS.join('|') + ')$', 'i')

/* 来源识别：正文里通常带工具名（页脚/链接），但真实样例工具名在页脚，
 * 故补充格式指纹（Apifox 的 `Base URLs:` / `> 返回示例` / `> 200 Response`；
 * Apipost 的 `{{host}}` / `**接口URL**` / `由 ApiPost 导出`）。 */
export const SOURCE_MARKS = [
  { key: 'apifox', re: /apifox|Base URLs:|> 200 Response|> 返回示例|> Body 请求参数/i },
  { key: 'apipost', re: /apipost|\{\{host\}\}|\*\*接口URL\*\*|\*\*请求方式\*\*|由 ApiPost|ApiPost/i }
]

/* method + path 抽取：按序尝试，第一个命中即用（行内/标题/独立行） */
export const METHOD_PATH_RULES = [
  /^\**\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\**\s*[`\s:：\-–—|,，]*\s*`?(\/[^\s`'）)]*)/i,
  /^\**\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\**\s*[`\s:：\-–—|]*\s*`?(https?:\/\/[^\s`'）)]+)/i,
  /(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\/[A-Za-z0-9_\-./:{}$[\]]*)/,
  /(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*[`\s:：]+\s*`?(https?:\/\/[^\s`'）)]+)/
]

/* 表格列别名 → 结构化字段（拿到真实样例后只改这里） */
export const COL_ALIASES = {
  name: /^(名称|参数名|字段名|字段|参数|参数名称|错误码|状态码|返回码|Code|Name|Field|Key)$/i,
  pos: /^(位置|参数位置|参数所在位置|Location|in)$/i,
  type: /^(类型|参数类型|字段类型|数据类型|Type)$/i,
  required: /^(必填|是否必填|是否必选|必选|必需|必须|是否必须|Required)$/i,
  desc: /^(说明|描述|参数描述|备注|字段说明|参数说明|描述信息|Description|Desc|Remark)$/i,
  example: /^(示例|示例值|默认值|样例|Example|Sample|Default)$/i,
  model: /^(数据模型|模型|Schema|Model)$/i
}

export const EXAMPLE_LANGS = ['json', 'javascript', 'js', 'bash', 'shell', 'curl', 'http', 'xml', 'yaml', 'java', 'python']

/* ======================== 基础工具 ======================== */

export function normalize (text) {
  return String(text == null ? '' : text).replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\t/g, '  ')
}

export function stripMd (s) {
  return String(s == null ? '' : s).replace(/\*\*/g, '').replace(/`/g, '').trim()
}

export function detectSource (text) {
  const s = String(text == null ? '' : text).slice(0, 30000)
  for (const m of SOURCE_MARKS) if (m.re.test(s)) return m.key
  return 'unknown'
}

export function extractMethodPath (s) {
  const text = String(s == null ? '' : s)
  for (const re of METHOD_PATH_RULES) {
    const m = re.exec(text)
    if (m) return { method: String(m[1]).toUpperCase(), path: String(m[2]).trim() }
  }
  return null
}

export function normRequired (v) {
  const s = String(v == null ? '' : v).trim().toLowerCase()
  if (!s) return false
  if (/^(是|必填|必须|必选|required|true|y|yes|√|✓|1|需要)$/.test(s)) return true
  return false
}

export function nameOfFile (n) {
  return String(n || '')
    .replace(/\.(md|markdown)$/i, '')
    // 工具前缀后必须跟分隔符才剥离（"apifox-用户中心" → "用户中心"），
    // 否则 "apifox.md" 这类真实导出文件名会被剥成空 → 退回"未命名模块"
    .replace(/^(apifox|apipost)[-_\s]+/i, '')
    .trim() || '未命名模块'
}

/* ======================== 块扫描 ======================== */

export function scanBlocks (text) {
  const src = normalize(text)
  if (!src.trim()) return []
  const lines = src.split('\n')
  const blocks = []
  let para = null
  const flushPara = () => {
    if (para) {
      const t = para.join('\n').trim()
      if (t) blocks.push({ type: 'text', text: t })
      para = null
    }
  }
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      flushPara()
      blocks.push({ type: 'h', level: h[1].length, text: h[2].replace(/\s+#+\s*$/, '').trim() })
      i++
      continue
    }
    const fence = /^\s*(```|~~~)\s*([^\s`]*)/.exec(line)
    if (fence) {
      flushPara()
      const lang = String(fence[2] || '').toLowerCase()
      i++
      const buf = []
      while (i < lines.length && !/^\s*(```|~~~)\s*$/.test(lines[i])) { buf.push(lines[i]); i++ }
      i++
      blocks.push({ type: 'code', lang, code: buf.join('\n') })
      continue
    }
    if (isTableStart(lines, i)) {
      flushPara()
      const rows = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const row = splitRow(lines[i])
        if (!isSepRow(row)) rows.push(row)
        i++
      }
      blocks.push({ type: 'table', rows })
      continue
    }
    if (!line.trim()) { flushPara(); i++; continue }
    if (!para) para = []
    para.push(line)
    i++
  }
  flushPara()
  return blocks
}

function isTableStart (lines, i) {
  const cur = lines[i]
  if (!/^\s*\|/.test(cur)) return false
  const nx = lines[i + 1] || ''
  return /\|/.test(nx) && /^\s*\|?[\s:\-|]+\|?\s*$/.test(nx) && /-/.test(nx)
}

function splitRow (line) {
  let s = String(line).trim()
  if (s.charAt(0) === '|') s = s.slice(1)
  if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1)
  const cells = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i)
    if (c === '\\' && s.charAt(i + 1) === '|') { cur += '|'; i++; continue }
    if (c === '|') { cells.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  cells.push(cur.trim())
  return cells.map(x => x.replace(/<br\s*\/?>/gi, '\n').trim())
}

function isSepRow (cells) {
  if (!cells.length) return false
  return cells.every(c => /^:?-{1,}:?$/.test(c))
}

/* ======================== 表格 → 参数行 ======================== */

export function tableToRows (block) {
  if (!block || block.type !== 'table' || !block.rows.length) return []
  const head = block.rows[0].map(x => String(x).replace(/\*\*/g, '').trim())
  const idx = {}
  head.forEach((h, i) => {
    for (const key in COL_ALIASES) {
      if (idx[key] === undefined && COL_ALIASES[key].test(h)) idx[key] = i
    }
  })
  if (idx.name === undefined) {
    // 首列当作名称列（状态码表、无表头别名的表兜底）
    if (head.length >= 1) idx.name = 0
    else return []
  }
  const out = []
  for (let r = 1; r < block.rows.length; r++) {
    const cells = block.rows[r]
    const rawName = cellAt(cells, idx.name)
    const name = rawName.replace(/^[\s　│├└\-─]+/, '').trim()
    if (!name) continue
    out.push({
      name,
      type: cellAt(cells, idx.type),
      required: idx.required !== undefined ? normRequired(cellAt(cells, idx.required)) : false,
      desc: cellAt(cells, idx.desc),
      example: cellAt(cells, idx.example),
      pos: idx.pos !== undefined ? cellAt(cells, idx.pos).toLowerCase() : '',
      model: cellAt(cells, idx.model)
    })
  }
  return out
}

function cellAt (cells, i) {
  if (i === undefined || i == null) return ''
  return String(cells[i] == null ? '' : cells[i]).trim()
}

/* ======================== 分节分类 / 元信息标签 ======================== */

/* 小标题 / 加粗标签 / 引用块 → 语义分节（顺序敏感：更具体/响应优先） */
function classify (t) {
  const s = stripMd(t).trim()
  if (/返回示例|响应示例|响应结果|返回结果|出参|响应参数|返回参数|Response|返回报文|响应报文/i.test(s)) {
    return /示例/.test(s) ? 'res-example' : 'resp'
  }
  if (/请求示例|示例请求|请求报文|Request\s*Example/i.test(s)) return 'req-example'
  if (/目录|公共参数|全局参数|全局/.test(s)) return 'catalog'
  if (/Header|请求头|请求头部|header/i.test(s)) return 'req-headers'
  if (/Query|查询参数|查询/.test(s)) return 'req-query'
  if (/Body|请求体|请求参数|入参|参数说明|参数|表单参数/i.test(s)) return 'req-body'
  return 'other'
}
const RESPONSE_KINDS = new Set(['resp', 'res-example'])
const PARAM_KINDS = new Set(['req-headers', 'req-query', 'req-body'])

/* 加粗「键：值」中的元信息键 */
function metaKeyOf (label) {
  const s = stripMd(label).trim()
  if (/接口URL|接口地址|请求地址|请求路径|接口路径|路径|地址|URL|URI/i.test(s)) return 'url'
  if (/请求方式|请求方法|方法|请求类型|Method/i.test(s)) return 'method'
  return null
}
/* 纯元信息类加粗标签（不影响 desc，也不当分节）：Content-Type / 接口状态 / 认证 / 创建人 / 时间 等 */
function isIgnorableMeta (label) {
  const s = stripMd(label).trim()
  return /Content-Type|接口状态|认证方式|认证信息|创建人|更新人|创建时间|更新时间|目录|公共参数|全局/.test(s)
}

function cleanPath (v) {
  return String(v == null ? '' : v)
    .replace(/\{\{[^}]+\}\}/g, '')      // 去掉 {{host}} 等模板占位
    .replace(/^https?:\/\/[^\/]+/, '')   // 去协议+域名，保留相对路径
    .replace(/^\s*[-–—]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isWriteMethod (m) {
  return /^(POST|PUT|PATCH|DELETE)$/i.test(m || '')
}

function posBucket (pos) {
  const p = String(pos || '').toLowerCase()
  if (/query|path|url/.test(p)) return 'query'
  if (/header/.test(p)) return 'headers'
  if (/body/.test(p)) return 'body'
  return 'query'
}

/* ======================== 接口边界 ======================== */

/* 优先 level2，无则 level3；都没有则回退到 method/path 行命中点 */
function splitEndpoints (blocks) {
  const levels = {}
  blocks.forEach(b => { if (b.type === 'h') levels[b.level] = (levels[b.level] || 0) + 1 })
  const level = levels[2] ? 2 : (levels[3] ? 3 : 0)
  if (!level) {
    const hasHit = blocks.some(b => b.type === 'text' && extractMethodPath(b.text))
    return hasHit ? splitByTextHit(blocks) : []
  }
  return splitByHeading(blocks, level)
}

function splitByHeading (blocks, level) {
  const eps = []
  let cur = null
  let group = ''
  for (const b of blocks) {
    if (b.type === 'h' && b.level === level) {
      if (cur) eps.push(cur)
      cur = { blocks: [], title: b.text, group }
      continue
    }
    if (b.type === 'h' && b.level < level) { group = b.text; continue }
    if (cur) cur.blocks.push(b)
  }
  if (cur) eps.push(cur)
  return eps
}

/* 兜底层级：标题里没有 method/path，但正文某段文本里有（如 `GET /x` 行） */
function splitByTextHit (blocks) {
  const eps = []
  let cur = null
  let pending = null
  let prev = ''
  for (const b of blocks) {
    if (b.type === 'h') { prev = pending ? pending.text : prev; pending = b; continue }
    if (b.type === 'text') {
      let hit = null
      b.text.split('\n').forEach(l => { if (!hit) hit = extractMethodPath(l) })
      if (hit) {
        if (cur) eps.push(cur)
        cur = { blocks: [], title: pending ? pending.text : '', group: prev, hit }
        pending = null
      }
    }
    if (pending) { if (cur) cur.blocks.push(pending); pending = null }
    if (cur) cur.blocks.push(b)
  }
  if (cur) eps.push(cur)
  return eps
}

/* ======================== 接口组装 ======================== */

function emptyEndpoint () {
  return {
    id: '', moduleId: '', group: '', name: '', method: '', path: '',
    summary: '', desc: '', headers: [], pathParams: [], query: [], body: [], responses: [],
    reqExample: null, resExample: null, extras: [], warnings: [], raw: ''
  }
}

function cleanName (title) {
  let s = stripMd(title)
  s = s.replace(/^[\d]+([.\-]\d+)*[.、\s]+/, '')
  return s.replace(/[`*_]/g, '').trim()
}

function blockText (b) {
  if (b.type === 'h') return '#'.repeat(b.level) + ' ' + b.text
  if (b.type === 'code') return '```' + (b.lang || '') + '\n' + b.code + '\n```'
  if (b.type === 'table') return b.rows.map(r => '| ' + r.join(' | ') + ' |').join('\n')
  return b.text
}

/* 描述去重：标题下方重复行（Apifox 常把接口名写两遍）、连续空白 */
function dedupeDesc (lines) {
  const out = []
  const seen = new Set()
  for (const l of lines) {
    const s = stripMd(l).trim()
    if (!s) continue
    const key = s.replace(/\s+/g, '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out.join('\n').trim()
}

/* 从接口区间内的块序列抽取 method/path/desc 与分节参数 */
function fillFromBlocks (ep, blocks) {
  let sig = 'init'              // 当前分节类别
  let metaLabel = null          // 'url' | 'method' | null（等待下一引用块取值）
  let firstSection = false      // 是否已遇到任一分节（desc 边界）
  let reqExampleSet = false
  let resExampleSet = false
  const descLines = []

  const markSection = (kind) => {
    sig = kind
    metaLabel = null
    if (PARAM_KINDS.has(kind) || RESPONSE_KINDS.has(kind) || kind === 'req-example' || kind === 'catalog') firstSection = true
  }

  const applyTable = (b) => {
    const rows = tableToRows(b)
    if (!rows.length) return
    if (sig === 'req-headers') { ep.headers = ep.headers.concat(rows); return }
    if (sig === 'req-query') { ep.query = ep.query.concat(rows); return }
    if (sig === 'req-body') {
      rows.forEach(r => {
        if (r.pos) { ep[posBucket(r.pos)] = ep[posBucket(r.pos)].concat(r); return }
        // 无位置列：按方法判定（POST/PUT/PATCH → body，否则 query）
        ep[isWriteMethod(ep.method) ? 'body' : 'query'] = (isWriteMethod(ep.method) ? ep.body : ep.query).concat(r)
      })
      return
    }
    if (RESPONSE_KINDS.has(sig)) { ep.responses = ep.responses.concat(rows); return }
    // 落单的表格：没有归属分节，按内容猜测
    if (!ep.query.length && !ep.body.length && !ep.responses.length) {
      ep.query = ep.query.concat(rows)
      ep.warnings.push('参数表未标注类型，已归入请求参数')
    } else {
      ep.extras.push({ title: '其他表格', kind: 'table', rows })
    }
  }

  const applyCode = (b) => {
    if (RESPONSE_KINDS.has(sig)) {
      if (!resExampleSet) { ep.resExample = { lang: b.lang || '', code: b.code }; resExampleSet = true }
      else ep.extras.push({ title: '返回示例', kind: 'code', lang: b.lang || '', code: b.code })
      return
    }
    if ((sig === 'req-body' || sig === 'req-example') && isWriteMethod(ep.method)) {
      if (!reqExampleSet) { ep.reqExample = { lang: b.lang || '', code: b.code }; reqExampleSet = true }
      else ep.extras.push({ title: '请求示例', kind: 'code', lang: b.lang || '', code: b.code })
      return
    }
    ep.extras.push({ title: '示例代码', kind: 'code', lang: b.lang || '', code: b.code })
  }

  for (const b of blocks) {
    if (b.type === 'h') {
      const k = classify(b.text)
      if (k !== 'other') markSection(k)
      else { sig = 'other'; metaLabel = null }
      continue
    }
    if (b.type === 'table') { applyTable(b); continue }
    if (b.type === 'code') { applyCode(b); continue }

    // 文本块：逐行解析（引用块 / 加粗标签 / 加粗键:值 / 方法路径行 / 描述）
    const lines = b.text.split('\n')
    for (const rawLine of lines) {
      const isQuote = /^\s*>/.test(rawLine)
      const line = rawLine.replace(/^\s*>\s?/, '').trim()
      // 整行加粗标签：**请求Header参数** / **接口URL** / **微信小程序登录：...**
      const bold = /^\*\*(.+?)\*\*$/.exec(rawLine.trim())
      if (bold) {
        const label = bold[1].trim()
        const k = classify(label)
        if (k !== 'other') { markSection(k); continue }
        const mk = metaKeyOf(label)
        if (mk) { metaLabel = mk; sig = 'other'; continue }
        if (isIgnorableMeta(label)) { sig = 'other'; continue }
        if (!firstSection) descLines.push(label)   // 加粗描述行
        continue
      }
      // 加粗「键：值」：**请求方法**：POST / **接口地址**：/path / 接口描述：xxx
      const fsplit = /^\*?\*?([^*：:\n]+?)\*?\*?\s*[：:]\s*(.+)$/.exec(rawLine.trim())
      if (fsplit) {
        const k = fsplit[1].trim()
        const v = stripMd(fsplit[2]).trim()
        if (/请求方式|请求方法|方法|Method/i.test(k)) { ep.method = v.toUpperCase(); continue }
        if (/接口地址|接口URL|接口路径|请求地址|路径|地址|URL|Path|URI/i.test(k)) { ep.path = cleanPath(v); continue }
        if (/接口描述|描述|说明|Description/i.test(k) && !firstSection) { descLines.push(v); continue }
      }
      // 引用块取值（接口URL / 请求方式 之后的 `> xxx`）
      if (metaLabel === 'url') { if (line) ep.path = cleanPath(line); metaLabel = null; continue }
      if (metaLabel === 'method') {
        const m = METHOD_RE.exec(line)
        if (m) ep.method = m[0].toUpperCase()
        metaLabel = null
        continue
      }
      // 引用块分节信号：> 返回示例 / > 200 Response / > Body 请求参数
      const k2 = classify(line)
      if (k2 !== 'other') { markSection(k2); continue }
      // 独立方法路径行：GET /api/x
      const mp = extractMethodPath(line)
      if (mp) { if (!ep.method) ep.method = mp.method; if (!ep.path) ep.path = mp.path; continue }
      // 其余：描述（首个分节前、非引用块元信息）
      if (!firstSection && line && !/^(创建人|更新人|创建时间|更新时间|由\s)/i.test(line)) {
        descLines.push(line)
      }
    }
  }
  ep.desc = dedupeDesc(descLines)
}

function buildEndpoint (c, i) {
  const ep = emptyEndpoint()
  ep.id = String(i)
  ep.group = c.group || ''
  // 标题含方法（Apifox：## GET 名称）
  const titleText = stripMd(c.title)
  const tm = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b[\s:：]+(.*)$/i.exec(titleText)
  if (tm) { ep.method = tm[1].toUpperCase(); ep.name = cleanName(tm[2]) }
  else { ep.name = cleanName(titleText) }
  if (c.hit) { if (!ep.method) ep.method = c.hit.method; if (!ep.path) ep.path = c.hit.path }
  try {
    fillFromBlocks(ep, c.blocks)
  } catch (e) {
    ep.warnings.push('解析异常，已按原文展示')
    ep.raw = c.blocks.map(blockText).join('\n\n')
  }
  if (!ep.method || !ep.path) ep.warnings.push('未识别到请求方法或路径')
  if (!ep.name) ep.name = ep.path || ('接口 ' + (i + 1))
  if (!ep.raw) ep.raw = c.blocks.map(blockText).join('\n\n')
  return ep
}

/* ======================== 对外 API ======================== */

/* opts: { name, source }
 * source: 显式指定来源（'apifox'|'apipost'），仅用于标注/兜底，解析走统一规则；
 *         传 'auto' 或不传 → 自动识别。 */
export function parseMarkdown (text, opts = {}) {
  const o = opts || {}
  const raw = String(text == null ? '' : text)
  const out = {
    name: o.name || '',
    source: o.source || detectSource(raw),
    groups: [],
    endpoints: [],
    stats: { endpoints: 0, tables: 0, codes: 0, unknownSections: [] },
    warnings: [],
    raw
  }
  if (!raw.trim()) { out.warnings.push('文档为空'); return out }
  let blocks
  try {
    blocks = scanBlocks(raw)
  } catch (e) {
    out.warnings.push('文档结构解析失败，已按原文展示')
    return out
  }
  blocks.forEach(b => {
    if (b.type === 'table') out.stats.tables++
    if (b.type === 'code') out.stats.codes++
  })
  if (!out.name) {
    const h1 = blocks.filter(b => b.type === 'h' && b.level === 1)[0]
    if (h1) out.name = stripMd(h1.text)
  }
  let cuts = splitEndpoints(blocks)
  if (!cuts.length) cuts = splitByTextHit(blocks)
  if (!cuts.length) cuts = [{ blocks, title: out.name || '接口文档', group: '' }]
  let eps = cuts.map((c, i) => buildEndpoint(c, i))
  if (!eps.some(ep => ep.method || ep.path)) {
    out.warnings.push('未能识别为接口文档（未找到请求方法与路径），可查看原文')
    eps = []
  } else {
    eps.forEach(ep => { if (!ep.group) ep.group = '' })
    out.groups = groupEndpoints(eps)
  }
  out.endpoints = eps
  out.stats.endpoints = eps.length
  return out
}

function groupEndpoints (eps) {
  const map = {}
  const order = []
  eps.forEach(ep => {
    const g = ep.group || ''
    if (!map[g]) { map[g] = []; order.push(g) }
    map[g].push(ep)
  })
  return order.map(g => ({ title: g, endpoints: map[g] }))
}

export function parseFiles (files) {
  return (files || []).map(f => {
    const d = parseMarkdown(f && f.text, { name: nameOfFile(f && f.name) })
    d.fileName = (f && f.name) || ''
    return d
  })
}
