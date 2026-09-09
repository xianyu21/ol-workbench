'use strict';
/*
 * 用户数据持久化 key 单源（CJS 双格式，沿 scan-shared.js 先例）：
 * preload.js 直接 require；渲染层 user-data.js 经 vite commonjs 内联同一份。
 * key 清单是持久化的唯一声明处——新增持久化字段只改这里。
 */
const PREFIX = 'wb_axhub_';
const KEYS = [
  'projects',   // 页面清单 + 收藏库（收藏/标签/重命名/打开计数/封面）
  'tags',       // 标签定义
  'tabs',       // 标签页布局（含休眠态/src 快照）
  'active',     // 激活标签 id
  'settings',   // 界面设置（视图/maxAlive/分组/折叠/关闭行为）
  'tabSeq',     // 标签 id 自增序号
  'recent',     // 最近访问（页面 id，最新在前）
  'secClosed',  // 侧栏分组折叠状态
  'sbw'         // 侧栏宽度
];
module.exports = { PREFIX, KEYS };
