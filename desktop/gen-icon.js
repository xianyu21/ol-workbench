'use strict';
// 生成 build/icon.ico：与 picker.html logo 一致（蓝渐变圆角方块 + 白色三层菱形堆叠）
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

function inDiamond(cx, cy, halfW, halfH, x, y) {
  return Math.abs(x - cx) / halfW + Math.abs(y - cy) / halfH <= 1;
}

function drawPixel(fx, fy) {
  // 256 基准坐标；圆角方块背景（对角渐变 #1296db -> #36b1ef）
  const m = 12, rad = 52;
  const inX = fx >= m && fx < 256 - m, inY = fy >= m && fy < 256 - m;
  if (!inX || !inY) return [0, 0, 0, 0];
  const cx = Math.min(Math.max(fx, m + rad), 256 - m - rad);
  const cy = Math.min(Math.max(fy, m + rad), 256 - m - rad);
  if ((fx - cx) * (fx - cx) + (fy - cy) * (fy - cy) > rad * rad) return [0, 0, 0, 0];
  const t = (fx + fy) / 512;
  const r = Math.round(0x12 + (0x36 - 0x12) * t);
  const g = Math.round(0x96 + (0xb1 - 0x96) * t);
  const b = Math.round(0xdb + (0xef - 0xdb) * t);
  // 三层菱形（同 picker logo）
  for (const [cy2, hw] of [[110, 56], [140, 56], [170, 56]]) {
    if (inDiamond(128, cy2, hw, 30, fx, fy)) return [255, 255, 255, 255];
  }
  return [r, g, b, 255];
}

function makePng(size) {
  const png = new PNG({ width: size, height: size });
  const s = size / 256;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = drawPixel((x + 0.5) / s, (y + 0.5) / s);
      const i = (y * size + x) * 4;
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

// 多尺寸 PNG 帧打包为 ICO（Vista+ 支持 PNG 帧），不需要 jimp
function packIco(pngs) {
  // pngs: [{size, data(Buffer)}] 由大到小
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  const dirs = [], datas = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, data } of pngs) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size >= 256 ? 0 : size, 0);
    dir.writeUInt8(size >= 256 ? 0 : size, 1);
    dir.writeUInt16LE(1, 4); dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(data.length, 8); dir.writeUInt32LE(offset, 12);
    dirs.push(dir); datas.push(data);
    offset += data.length;
  }
  return Buffer.concat([header, ...dirs, ...datas]);
}

(async () => {
  const pngs = [256, 128, 64, 48, 32, 16].map(size => ({ size, data: makePng(size) }));
  const out = path.join(__dirname, 'build', 'icon.ico');
  fs.writeFileSync(out, packIco(pngs));
  console.log('icon written:', out);
})();
