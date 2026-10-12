'use strict';
/*
 * 更新增强 · 回滚（纯逻辑，依赖注入，可 node --test 用 mock 验证）。
 *
 * 策略（见架构 Q2）：不预缓存旧安装包，按需从 GitHub Releases 拉取目标旧版 NSIS
 * 安装包并执行覆盖安装（/S 静默）。离线环境拉取失败 → 由调用方降级为「失败卡 + 手动入口」。
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

/* 'https://github.com/owner/repo/releases' -> 'https://github.com/owner/repo' */
function releasesBaseFromUrl (releasesUrl) {
  return String(releasesUrl || '').replace(/\/releases\/?$/, '');
}

function assetName (version, ext) {
  return `AxHub-Setup-${version}.${ext || 'exe'}`;
}

function downloadUrl (base, version, ext) {
  return `${base}/releases/download/v${version}/${assetName(version, ext)}`;
}

/*
 * 准备回滚安装包：从 Releases 下载目标旧版的 NSIS 安装包到临时目录。
 * @param {string} oldVersion  目标回滚版本（如 '1.2.0'）
 * @param {object} [deps]
 * @param {string} [deps.releasesUrl]   发布页（默认 https://github.com/xianyu21/ol-workbench/releases）
 * @param {string} [deps.releasesBase]  仓库根（与 releasesUrl 二选一，优先）
 * @param {string} [deps.downloadUrl]   完整下载地址（测试注入，优先级最高）
 * @param {string} [deps.ext]           安装包扩展名（默认 exe）
 * @param {string} [deps.tempDir]       临时目录（默认 os.tmpdir()）
 * @param {object} [deps.https]         https 模块（默认 require('https')）
 * @param {object} [deps.fs]            fs 模块（默认 require('fs')）
 * @param {object} [deps.os]            os 模块（默认 require('os')）
 * @param {function(string,string):Promise<void>} [deps.download]  注入下载实现（测试用）
 * @returns {Promise<string>} 下载完成的安装包本地路径
 */
async function prepare (oldVersion, deps) {
  const d = deps || {};
  const https = d.https || require('https');
  const fsMod = d.fs || fs;
  const osMod = d.os || os;
  const base = d.releasesBase || releasesBaseFromUrl(d.releasesUrl || 'https://github.com/xianyu21/ol-workbench/releases');
  const url = d.downloadUrl || downloadUrl(base, oldVersion, d.ext);
  const tmpDir = d.tempDir || osMod.tmpdir();
  const dest = path.join(tmpDir, assetName(oldVersion, d.ext));

  if (typeof d.download === 'function') {
    await d.download(url, dest);
    return dest;
  }

  // GitHub Release 直链为 302 跳转到 S3/CDN，需跟随一次重定向
  await new Promise((resolve, reject) => {
    const onRes = (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, onRes2 => pipeTo(onRes2)).on('error', reject);
        return;
      }
      pipeTo(res);
    };
    const pipeTo = (res) => {
      const file = fsMod.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
      file.on('error', reject);
    };
    https.get(url, onRes).on('error', reject);
  });
  return dest;
}

/*
 * 执行回滚安装包（静默覆盖安装）。调用方在之后自行 app.quit()。
 * @param {string} installerPath  安装包路径（prepare 返回值）
 * @param {object} [deps]
 * @param {object} [deps.spawn]   child_process.spawn（默认 require('child_process').spawn）
 * @returns {object} 派生的子进程
 */
function exec (installerPath, deps) {
  const d = deps || {};
  const spawn = d.spawn || require('child_process').spawn;
  const child = spawn(installerPath, ['/S'], { detached: true, stdio: 'ignore', windowsHide: true });
  if (child.unref) child.unref();
  return child;
}

module.exports = { prepare, exec, releasesBaseFromUrl, downloadUrl, assetName };
