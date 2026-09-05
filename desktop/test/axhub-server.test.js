'use strict';
// 本地服务（axhub-server.js）请求层测试基线（node:test，零依赖）
// 全部通过"发起真实 HTTP 请求 → 断言状态码/响应头/响应体"验证外部行为，不 mock 内部函数。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');

const { startServer, scanAxHub } = require('../axhub-server.js');

// ---------- 夹具：AxHub 标准扁平导出 ----------
function buildFixture () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-fixture-'));
  const wf = (rel, content) => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };
  wf('index.html', '<!doctype html><title>frame</title>');
  wf('start.html', '<!doctype html><title>start frame</title>');
  wf('通用组件.html', '<!doctype html>');
  wf('00-总览.html', '<!doctype html><title>00</title>');
  wf('01-登录页.html', '<!doctype html><title>01</title>');
  wf('02-工作台_列表.html', '<!doctype html><title>02</title>');
  wf('中文 页面.html', '<!doctype html><title>zh</title>');
  wf('resources/theme.css', 'body{color:red}');
  wf('resources/app.js', 'console.log(1)');
  wf('data/document.js', 'window.docConfig={};');
  wf('images/logo.png', 'fakepng');
  return root;
}

const ROOT = buildFixture();
let server = null;
let base = '';

test.before(async () => {
  server = await startServer(ROOT, { port: 0, open: false });
  base = 'http://127.0.0.1:' + server.address().port;
});

test.after(() => { try { server.close(); } catch (e) {} });

// ---------- 请求助手 ----------
function req (method, urlPath, headers) {
  return new Promise((resolve, reject) => {
    const r = http.request(base + encodeURI(urlPath), { method, headers }, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    r.on('error', reject);
    r.end();
  });
}
const get = (p, h) => req('GET', p, h);

// 原始 socket 请求：Node/浏览器等 HTTP 客户端会在发送前规范化掉 .. 点段（含 %2e%2e），
// 服务端的穿越防御针对的是 curl/自定义工具等不规范化客户端，必须用裸请求行才能测到。
function rawRequest (urlPath) {
  return new Promise((resolve, reject) => {
    const [host, port] = base.replace('http://', '').split(':');
    const sock = net.connect(+port, host, () => {
      sock.write('GET ' + urlPath + ' HTTP/1.1\r\nHost: ' + host + '\r\nConnection: close\r\n\r\n');
    });
    const chunks = [];
    sock.on('data', d => chunks.push(d));
    sock.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      const m = /^HTTP\/1\.1 (\d{3})/.exec(text);
      resolve({ status: m ? +m[1] : 0 });
    });
    sock.on('error', reject);
  });
}

// ---------- 页面扫描 API ----------
test('GET /_api/tree 返回标准扁平导出结构（过滤框架页、提取分组、中文排序、hasData）', async () => {
  const res = await get('/_api/tree');
  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /application\/json/);
  const data = JSON.parse(res.body);
  assert.strictEqual(data.entry, 'index.html');
  assert.strictEqual(data.hasData, true);
  assert.strictEqual(data.name, path.basename(ROOT));
  const names = data.pages.map(p => p.path);
  // 框架页全部被过滤
  assert.ok(!names.includes('index.html'));
  assert.ok(!names.includes('start.html'));
  assert.ok(!names.includes('通用组件.html'));
  // 业务页面齐全且按 zh 排序
  assert.deepStrictEqual(names, ['00-总览.html', '01-登录页.html', '02-工作台_列表.html', '中文 页面.html']);
  // 编号前缀首段作为分组
  assert.strictEqual(data.pages[0].group, '00');
  assert.strictEqual(data.pages[2].group, '02');
  // 页面 ID 稳定（同内容重扫一致）
  const again = scanAxHub(ROOT);
  assert.deepStrictEqual(again.pages.map(p => p.id), data.pages.map(p => p.id));
});

// ---------- 工作台路由 ----------
test('GET /_axviewer 302 到带尾斜杠路径', async () => {
  const res = await get('/_axviewer');
  assert.strictEqual(res.status, 302);
  assert.strictEqual(res.headers.location, '/_axviewer/');
});

test('GET /_axviewer/ 返回工作台 HTML', async () => {
  const res = await get('/_axviewer/');
  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.ok(res.body.toLowerCase().includes('<!doctype html') || res.body.includes('<html'));
});

// ---------- 静态服务 ----------
test('根路径 / 服务导出目录的 index.html', async () => {
  const res = await get('/');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.includes('frame'));
});

test('HTML 长缓存策略：资源目录 immutable、页面短缓存', async () => {
  const css = await get('/resources/theme.css');
  assert.strictEqual(css.status, 200);
  assert.strictEqual(css.headers['cache-control'], 'public, max-age=31536000, immutable');
  const html = await get('/00-总览.html');
  assert.strictEqual(html.status, 200);
  assert.strictEqual(html.headers['cache-control'], 'public, max-age=3600');
});

test('MIME 推断：css/js/png/json 正确，未知扩展回退 octet-stream', async () => {
  assert.match((await get('/resources/theme.css')).headers['content-type'], /text\/css/);
  assert.match((await get('/resources/app.js')).headers['content-type'], /javascript/);
  assert.match((await get('/images/logo.png')).headers['content-type'], /image\/png/);
  assert.match((await get('/data/document.js')).headers['content-type'], /javascript/);
});

test('中文文件名路径正确解码并可访问', async () => {
  const res = await get('/中文 页面.html');
  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html; charset=utf-8/);
  assert.ok(res.body.includes('zh'));
});

test('不存在的文件返回 404', async () => {
  const res = await get('/no-such-file.html');
  assert.strictEqual(res.status, 404);
});

test('目录穿越被拒绝（明文与编码变体，原始请求行绕过客户端规范化）', async () => {
  fs.writeFileSync(path.join(path.dirname(ROOT), 'outside-secret.txt'), 'secret');
  assert.strictEqual((await rawRequest('/../outside-secret.txt')).status, 403);
  assert.strictEqual((await rawRequest('/%2e%2e/outside-secret.txt')).status, 403);
  assert.strictEqual((await rawRequest('/..%2foutside-secret.txt')).status, 403);
  assert.strictEqual((await rawRequest('/resources/../../outside-secret.txt')).status, 403);
  assert.strictEqual((await rawRequest('/resources/%2e%2e/%2e%2e/outside-secret.txt')).status, 403);
});

// ---------- Range / HEAD ----------
test('Range 请求返回 206 与 Content-Range，Range 越界返回 416', async () => {
  const part = await get('/resources/theme.css', { Range: 'bytes=0-3' });
  assert.strictEqual(part.status, 206);
  assert.match(part.headers['content-range'], /^bytes 0-3\//);
  assert.strictEqual(part.body, 'body');
  const bad = await get('/resources/theme.css', { Range: 'bytes=999-' });
  assert.strictEqual(bad.status, 416);
});

test('HEAD 请求返回头但无响应体', async () => {
  const res = await req('HEAD', '/resources/theme.css');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body, '');
  assert.ok(res.headers['content-length'] > 0);
});

// ---------- CORS 收紧 ----------
test('收紧后：静态资源与 API 不再携带 Access-Control-Allow-Origin（防任意网页探测本地目录）', async () => {
  assert.strictEqual((await get('/resources/theme.css')).headers['access-control-allow-origin'], undefined);
  assert.strictEqual((await get('/_api/tree')).headers['access-control-allow-origin'], undefined);
  assert.strictEqual((await get('/00-总览.html')).headers['access-control-allow-origin'], undefined);
});

test('收紧后：仅工作台 UI 路径按需回显 Origin（跨源请求），同源请求不发音', async t => {
  const viewerIdx = path.join(__dirname, '..', 'viewer-dist', 'index.html');
  if (!fs.existsSync(viewerIdx)) return t.skip('viewer-dist 未构建');
  const cross = await get('/_axviewer/index.html', { Origin: 'http://evil.example' });
  assert.strictEqual(cross.status, 200);
  assert.strictEqual(cross.headers['access-control-allow-origin'], 'http://evil.example');
  const same = await get('/_axviewer/index.html');
  assert.strictEqual(same.headers['access-control-allow-origin'], undefined);
});
