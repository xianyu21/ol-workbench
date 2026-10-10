'use strict';
/*
 * api-docs-md 解析层单测：Apifox / Apipost 两种导出格式 → 同一套 endpoint 结构。
 * 运行：cd desktop && node --test test/api-docs-md.test.js
 */
const test = require('node:test');
const assert = require('node:assert');

let M;
test.before(async () => { M = await import('../viewer/src/lib/api-docs-md.js'); });

const APIFOX_MD = [
  '# 用户管理', '',
  '## 1. 获取用户列表', '',
  '`GET /api/v1/users`', '',
  '### 请求参数', '',
  '| 参数名 | 类型 | 必填 | 说明 | 示例 |',
  '| --- | --- | --- | --- | --- |',
  '| page | integer | 是 | 页码 | 1 |',
  '| size | integer | 否 | 每页条数 | 20 |', '',
  '### 返回示例', '',
  '```json',
  '{ "code": 0, "data": [] }',
  '```', '',
  '## 2. 创建用户', '',
  '`POST /api/v1/users`', '',
  '### 请求参数', '',
  '| 参数名 | 类型 | 必填 | 说明 |',
  '| --- | --- | --- | --- |',
  '| name | string | 是 | 用户名 |', '',
  '> 本文档由 Apifox 导出 · https://apifox.com'
].join('\n');

const APIPOST_MD = [
  '# 用户模块', '',
  '### 创建用户', '',
  '**请求方法**：POST', '',
  '**接口地址**：/api/v1/users', '',
  '#### 请求参数', '',
  '| 名称 | 类型 | 是否必填 | 描述 |',
  '| --- | --- | --- | --- |',
  '| name | string | 是 | 用户名 |',
  '| age | integer | 否 | 年龄 |', '',
  '> 由 ApiPost 导出 · https://www.apipost.cn'
].join('\n');

test('Apifox：识别接口边界、method/path 与参数表', () => {
  const d = M.parseMarkdown(APIFOX_MD, { name: '用户管理' });
  assert.strictEqual(d.source, 'apifox');
  assert.strictEqual(d.endpoints.length, 2);

  const ep = d.endpoints[0];
  assert.strictEqual(ep.method, 'GET');
  assert.strictEqual(ep.path, '/api/v1/users');
  assert.strictEqual(ep.name, '获取用户列表');
  // GET 下的「请求参数」归入 query，而不是请求体
  assert.strictEqual(ep.query.length, 2);
  assert.deepStrictEqual(
    [ep.query[0].name, ep.query[0].type, ep.query[0].required, ep.query[0].example],
    ['page', 'integer', true, '1']);
  assert.strictEqual(ep.query[1].required, false);
  assert.strictEqual(ep.resExample.lang, 'json');
  assert.ok(ep.resExample.code.includes('"code": 0'));

  const ep2 = d.endpoints[1];
  assert.strictEqual(ep2.method, 'POST');
  assert.strictEqual(ep2.name, '创建用户');
  assert.strictEqual(ep2.body.length, 1);
  assert.strictEqual(ep2.body[0].name, 'name');
});

test('Apipost：**键**：值 元信息 + 别名列名 → 与 Apifox 同构', () => {
  const d = M.parseMarkdown(APIPOST_MD);
  assert.strictEqual(d.source, 'apipost');
  assert.strictEqual(d.endpoints.length, 1);
  const ep = d.endpoints[0];
  assert.strictEqual(ep.method, 'POST');
  assert.strictEqual(ep.path, '/api/v1/users');
  assert.strictEqual(ep.name, '创建用户');
  assert.strictEqual(ep.body.length, 2);
  const name = ep.body.filter(r => r.name === 'name')[0];
  assert.strictEqual(name.required, true);
  assert.strictEqual(name.desc, '用户名');
  assert.strictEqual(ep.body.filter(r => r.name === 'age')[0].required, false);
});

test('降级：空 / 非接口文档不抛错，返回空接口 + 原文 + 告警', () => {
  for (const bad of ['', '# 说明\n\n随便写点东西。', null, undefined]) {
    const d = M.parseMarkdown(bad);
    assert.strictEqual(d.endpoints.length, 0);
    assert.ok(d.warnings.length > 0);
    assert.strictEqual(typeof d.raw, 'string');
  }
  const t = M.parseMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |');
  assert.strictEqual(t.endpoints.length, 0);
  assert.ok(Array.isArray(t.endpoints));
});

test('块扫描：标题 / 表格 / 代码块 / 文本四类', () => {
  const blocks = M.scanBlocks('# T\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n```json\n{}\n```\n\n正文');
  const types = blocks.map(b => b.type);
  assert.deepStrictEqual(types, ['h', 'table', 'code', 'text']);
  assert.strictEqual(blocks[0].level, 1);
  assert.strictEqual(blocks[1].rows.length, 2);
  assert.strictEqual(blocks[2].lang, 'json');
});

test('工具函数：method/path 抽取、必填归一化、文件名取模块名', () => {
  assert.deepStrictEqual(M.extractMethodPath('`GET /api/v1/users`'), { method: 'GET', path: '/api/v1/users' });
  assert.deepStrictEqual(M.extractMethodPath('**POST**：https://a.com/x'), { method: 'POST', path: 'https://a.com/x' });
  assert.strictEqual(M.extractMethodPath('随便写点东西'), null);
  assert.strictEqual(M.normRequired('是'), true);
  assert.strictEqual(M.normRequired('否'), false);
  assert.strictEqual(M.normRequired(''), false);
  assert.strictEqual(M.nameOfFile('Apifox-用户管理.md'), '用户管理');
  // 裸工具名的真实导出文件（用户样例即 apifox.md / apipost.md）不能被剥成空
  assert.strictEqual(M.nameOfFile('apifox.md'), 'apifox');
  assert.strictEqual(M.nameOfFile('apipost.md'), 'apipost');
});

/* ---------- 真实导出格式（来自用户样例） ---------- */

test('真实 Apifox：## METHOD 标题 + 独立 GET 行 + 位置列 + 返回示例引用块', () => {
  const md = [
    '# 公众号接口/类目相关', '',
    '<a id="opIdcategoryListByType"></a>', '',
    '## GET 按商家类型查询启用类目', '',
    'GET /api/category/list', '',
    '按商家类型查询启用类目', '',
    '### 请求参数', '',
    '|名称|位置|类型|必选|说明|',
    '|---|---|---|---|---|',
    '|merchantType|query|integer| 是 |none|', '',
    '> 返回示例', '',
    '> 200 Response', '',
    '```json',
    '{"code":0}',
    '```', '',
    '### 返回结果', '',
    '|状态码|状态码含义|说明|数据模型|',
    '|---|---|---|---|',
    '|200|[OK]|none|List|'
  ].join('\n');
  const d = M.parseMarkdown(md);
  assert.strictEqual(d.source, 'apifox');
  assert.strictEqual(d.endpoints.length, 1);
  const ep = d.endpoints[0];
  assert.strictEqual(ep.method, 'GET');
  assert.strictEqual(ep.path, '/api/category/list');
  assert.strictEqual(ep.name, '按商家类型查询启用类目');
  // 位置列为 query → 归入 query（而非 body）
  assert.strictEqual(ep.query.length, 1);
  assert.strictEqual(ep.query[0].name, 'merchantType');
  assert.strictEqual(ep.query[0].required, true);
  // 返回结果状态码表 → responses
  assert.strictEqual(ep.responses.length, 1);
  assert.strictEqual(ep.resExample.lang, 'json');
  assert.strictEqual(ep.warnings.length, 0);
});

test('真实 Apipost：## 名称 + **接口URL**/**请求方式** 标签 + {{host}} + **请求Body参数**', () => {
  const md = [
    '## 微信登录', '',
    '**微信小程序登录：用 code 换取 openid**', '',
    '**接口URL**', '',
    '> {{host}}/api/user/wxlogin', '',
    '**请求方式**', '',
    '> POST', '',
    '**请求Header参数**', '',
    '| 参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述 |',
    '| --- | --- | ---- | ---- | ---- |',
    '| token | your_token | string | 是 | 登录令牌 |', '',
    '**请求Body参数**', '',
    '```javascript',
    '{"code":"x"}',
    '```', '',
    '| 参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述 |',
    '| --- | --- | ---- | ---- | ---- |',
    '| code | x | string | 是 | 凭证 |', '',
    '**响应示例**', '',
    '```javascript',
    '{"code":1}',
    '```'
  ].join('\n');
  const d = M.parseMarkdown(md);
  assert.strictEqual(d.source, 'apipost');
  assert.strictEqual(d.endpoints.length, 1);
  const ep = d.endpoints[0];
  assert.strictEqual(ep.method, 'POST');
  assert.strictEqual(ep.path, '/api/user/wxlogin'); // {{host}} 被清理
  assert.strictEqual(ep.name, '微信登录');
  assert.strictEqual(ep.headers.length, 1);
  assert.strictEqual(ep.headers[0].name, 'token');
  assert.strictEqual(ep.headers[0].required, true);
  assert.strictEqual(ep.body.length, 1);
  assert.strictEqual(ep.body[0].name, 'code');
  assert.strictEqual(ep.body[0].required, true);
  assert.strictEqual(ep.reqExample.lang, 'javascript');
  assert.strictEqual(ep.resExample.lang, 'javascript');
  assert.strictEqual(ep.warnings.length, 0);
});

test('来源覆盖：opts.source 优先于自动识别', () => {
  // 一段不含指纹、但能被统一规则解析的文档：自动识别为 unknown
  const md = [
    '## 获取列表', '',
    'GET /x/list', '',
    '### 请求参数', '',
    '| name | type | required | desc |',
    '| --- | --- | --- | --- |',
    '| a | string | 是 | 测试 |'
  ].join('\n');
  const auto = M.parseMarkdown(md);
  assert.strictEqual(auto.source, 'unknown');
  const forced = M.parseMarkdown(md, { source: 'apifox' });
  assert.strictEqual(forced.source, 'apifox');
  // 解析结果不受 source 影响（统一规则）
  assert.strictEqual(forced.endpoints.length, auto.endpoints.length);
  assert.strictEqual(forced.endpoints[0].method, 'GET');
});
