/* API 视图 · 侧栏组件共用小工具（高亮 / 方法色类 / 复制） */
import { message } from 'ant-design-vue'

const METHOD_WHITE = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

/* method 类名必须走白名单，禁止把任意文本渲染成类名 */
export function mcls (m) {
  const up = String(m || '').toUpperCase()
  return METHOD_WHITE.indexOf(up) >= 0 ? up : 'ANY'
}

function esc (s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

/* 搜索词高亮：q 为空直接转义返回；多词 AND 高亮 */
export function hi (text, q) {
  const t = String(text == null ? '' : text)
  const qs = String(q || '').trim()
  let out = esc(t)
  if (!qs) return out
  qs.split(/\s+/).forEach(w => {
    if (!w) return
    const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')
    out = out.replace(re, '<mark>$1</mark>')
  })
  return out
}

export function copyText (t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(() => message.success('已复制'), () => message.error('复制失败'))
  } else message.error('当前环境不支持复制')
}
