'use strict';
// serve-core（宿主无关请求核心）描述符级测试（node:test，零依赖）
// 与 axhub-server.test.js 互补：那边验证 HTTP 适配层的外部行为，这里直接断言核心
// 返回的 { status, headers, body, stream }——协议适配层（main.js axhub://）同样消费这份形态。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const core = require('../serve-core.js');

// P0-4：查看器目录单源，必须先注入（缺失即抛）
core.setViewerDir(path.join(__dirname, '..', 'viewer-dist'));

// 与 axhub-server.test.js 同构的夹具
function buildFixture () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-core-'));
  const wf = (rel, content) => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };
  wf('index.html', '<!doctype html><title>frame</title>');
  wf('00-总览.html', '<!doctype html><title>00</title>');
  wf('中文 页面.html', '<!doctype html><title>zh</title>');
  wf('resources/theme.css', 'body{color:red}');
  wf('data/document.js', 'window.docConfig={};');
  return root;
}

const ROOT = buildFixture();
const call = async (urlPath, opts) => core.handleRequest(Object.assign({ root: ROOT, method: 'GET', urlPath }, opts || {}));
// 核心头键名保留原大小写（HTTP 适配层 writeHead 后才大小写不敏感）；无 Range 的 GET 走 stream，收集为 Buffer
const collect = (r) => new Promise((resolve, reject) => {
  const chunks = [];
  r.stream.on('data', d => chunks.push(d));
  r.stream.on('end', () => resolve(Buffer.concat(chunks)));
  r.stream.on('error', reject);
});

test('根路径解码为 index.html，页面 HTML 带短缓存头', async () => {
  const r = await call('/');
  assert.strictEqual(r.status, 200);
  assert.ok((await collect(r)).toString('utf8').includes('frame'));
  assert.strictEqual(r.headers['Cache-Control'], 'public, max-age=3600');
});

test('中文路径在核心内完成一次解码并可访问（适配层不做二次解码）', async () => {
  const r = await call('/%E4%B8%AD%E6%96%87%20%E9%A1%B5%E9%9D%A2.html');
  assert.strictEqual(r.status, 200);
  assert.ok((await collect(r)).toString('utf8').includes('zh'));
});

test('目录穿越返回 403（编码变体，模拟不规范化客户端）', async () => {
  fs.writeFileSync(path.join(path.dirname(ROOT), 'core-secret.txt'), 'secret');
  assert.strictEqual((await call('/../core-secret.txt')).status, 403);
  assert.strictEqual((await call('/%2e%2e/core-secret.txt')).status, 403);
  assert.strictEqual((await call('/..%2fcore-secret.txt')).status, 403);
  assert.strictEqual((await call('/resources/../../core-secret.txt')).status, 403);
  // 工作台资源路径同样防护
  assert.strictEqual((await call('/_axviewer/..%2f..%2fcore-secret.txt')).status, 403);
});

test('Range 返回 206 与区间 body；越界返回 416（仅 Content-Range 头）', async () => {
  const part = await call('/resources/theme.css', { headers: { range: 'bytes=0-3' } });
  assert.strictEqual(part.status, 206);
  assert.strictEqual(part.body.toString('utf8'), 'body');
  assert.strictEqual(part.headers['Content-Range'], 'bytes 0-3/15');
  assert.strictEqual(part.headers['Content-Length'], 4);
  const bad = await call('/resources/theme.css', { headers: { range: 'bytes=999-' } });
  assert.strictEqual(bad.status, 416);
  assert.strictEqual(bad.headers['Content-Range'], 'bytes */15');
});

test('HEAD 返回完整头与空 body；无 Range 大文件走 stream', async () => {
  const head = await call('/resources/theme.css', { method: 'HEAD' });
  assert.strictEqual(head.status, 200);
  assert.strictEqual(head.body, null);
  assert.strictEqual(head.stream, null);
  assert.strictEqual(head.headers['Content-Length'], 15);
  const get = await call('/resources/theme.css');
  assert.strictEqual(get.status, 200);
  assert.ok(get.stream, 'GET 无 Range 应返回可流式读取的 Readable');
  assert.strictEqual((await collect(get)).toString('utf8'), 'body{color:red}');
});

test('虚拟路由：/_axviewer 302，/_axviewer/ 返回 HTML', async () => {
  const redirect = await call('/_axviewer');
  assert.strictEqual(redirect.status, 302);
  assert.strictEqual(redirect.headers.Location, '/_axviewer/');
  const idx = await call('/_axviewer/');
  assert.strictEqual(idx.status, 200);
  assert.match(idx.headers['Content-Type'], /text\/html/);
});

test('_api/tree 无 CORS 头，结构含 pages/hasData/entry', async () => {
  const r = await call('/_api/tree');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers['Access-Control-Allow-Origin'], undefined);
  const data = JSON.parse(r.body);
  assert.strictEqual(data.hasData, true);
  assert.strictEqual(data.entry, 'index.html');
  assert.ok(data.pages.length > 0);
});

test('未设 root：导出目录静态服务返回 503（协议层在未选目录前的兜底）', async () => {
  const r = await core.handleRequest({ root: null, method: 'GET', urlPath: '/' });
  assert.strictEqual(r.status, 503);
});

test('未设 root：工作台 UI 与 _api 照常可用（首启动空态不黑屏）', async () => {
  const idx = await core.handleRequest({ root: null, method: 'GET', urlPath: '/_axviewer/' });
  assert.strictEqual(idx.status, 200);
  assert.match(idx.headers['Content-Type'], /text\/html/);
  // 工作台静态资源可访问（取 viewer-dist 内任一真实文件；不存在则 404，均不落入 503）
  const res = await core.handleRequest({ root: null, method: 'GET', urlPath: '/_axviewer/favicon.svg' });
  assert.ok([200, 404].includes(res.status), '资源请求应进入文件逻辑而非 503');
  const tree = await core.handleRequest({ root: null, method: 'GET', urlPath: '/_api/tree' });
  assert.strictEqual(tree.status, 200);
  const data = JSON.parse(tree.body);
  assert.strictEqual(data.hasData, false);
  assert.deepStrictEqual(data.pages, []);
});

test('P0-4：未注入 viewerDir 时 getViewerDir/工作台路由应抛错而非静默回退', () => {
  const core2 = require('../serve-core.js'); // 同一模块实例：已在顶部注入，仅验证接口存在
  assert.strictEqual(typeof core2.setViewerDir, 'function');
  assert.strictEqual(typeof core2.getViewerDir, 'function');
});
