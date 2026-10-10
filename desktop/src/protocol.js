'use strict';
/*
 * axhub:// 自定义协议适配层（宿主无关核心 → web Response）。
 * 这里只做「serve-core 描述符 → Response」的薄胶水，不含任何业务/Electron 状态。
 */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const core = require('../serve-core.js');
const ctx = require('./context.js');

/**
 * 注册 axhub:// 协议处理（standard + secure + supportFetchAPI + stream）。
 * @param {{protocol: object, net: object}} deps
 */
function registerAxhubProtocol ({ protocol, net }) {
  protocol.handle('axhub', async (req) => {
    const log = ctx.log;
    try {
      const u = new URL(req.url);
      const headers = {};
      for (const [k, v] of req.headers.entries()) headers[k.toLowerCase()] = v;
      // 全异步：await 核心描述符（内部 fs.promises + 流式）
      const r = await core.handleRequest({ root: core.getRoot(), method: req.method, urlPath: u.pathname, headers });
      const init = { status: r.status, headers: r.headers };
      if (r.file) {
        // 无 Range 的静态文件：net.fetch(file://) 返回协议层可正确消费的 web 流
        try {
          const fres = await net.fetch(pathToFileURL(r.file).toString());
          init.body = fres.body;
        } catch (e) {
          log('axhub stream fallback to buffer:', r.file, e && e.message);
          init.body = await fs.promises.readFile(r.file);
        }
      } else if (r.body !== null && r.body !== undefined) {
        init.body = r.body;
      }
      return new Response(init.body ?? null, init);
    } catch (err) {
      log('axhub protocol error:', err && err.message);
      return new Response('Internal Server Error: ' + (err && err.message || String(err)), {
        status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  });
}

module.exports = { registerAxhubProtocol };
