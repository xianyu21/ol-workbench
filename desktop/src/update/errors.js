'use strict';
/*
 * 更新增强 · 失败原因枚举单源（纯逻辑）。
 * 渲染层不持有枚举值 —— 主进程在 IPC 事件中直发可读 FailureDescriptor，
 * 渲染层只做展示。此处同时提供 describe() 文案与 mapInstallError() 归因。
 */

/* 失败原因枚举（单源） */
const FailureReason = Object.freeze({
  DISK_SPACE: 'DISK_SPACE',           // 磁盘空间不足
  NO_WRITE_PERMISSION: 'NO_WRITE_PERMISSION', // 安装目录无写入权限
  FILE_IN_USE: 'FILE_IN_USE',         // 文件被占用（另一实例 / Explorer 锁定）
  AV_BLOCKED: 'AV_BLOCKED',           // 被防病毒拦截
  UNKNOWN: 'UNKNOWN'                  // 未知（附原始退出码 / 消息）
});

/* 各原因的展示文案（title / hint / action / canRetry） */
const DESCRIPTIONS = Object.freeze({
  DISK_SPACE: {
    title: '磁盘空间不足',
    hint: '安装更新需要至少 300MB 可用空间，当前磁盘剩余空间不足。',
    action: '清理磁盘空间后重试',
    canRetry: true
  },
  NO_WRITE_PERMISSION: {
    title: '安装目录无写入权限',
    hint: '当前用户没有写入安装目录的权限，无法完成更新安装。',
    action: '以管理员身份运行，或更改安装目录后重试',
    canRetry: false
  },
  FILE_IN_USE: {
    title: '文件被占用',
    hint: '安装程序无法替换正在使用的文件，可能是另一个实例或资源管理器锁定了目录。',
    action: '关闭其他实例后重试',
    canRetry: true
  },
  AV_BLOCKED: {
    title: '被防病毒软件拦截',
    hint: '更新安装可能被防病毒软件拦截或隔离。',
    action: '将程序加入防病毒白名单后重试',
    canRetry: true
  },
  UNKNOWN: {
    title: '更新失败',
    hint: '更新过程中发生未知错误。',
    action: '重试，或前往 Releases 页面手动更新',
    canRetry: true
  }
});

/*
 * 生成可读的 FailureDescriptor（渲染层展示用）。
 * @param {string} reason  FailureReason 枚举值
 * @param {object} [extra] 额外字段（如 message / code / detail）合并进描述
 * @returns {{reason:string,title:string,hint:string,action:string,canRetry:boolean}}
 */
function describe (reason, extra) {
  const base = DESCRIPTIONS[reason] || DESCRIPTIONS[FailureReason.UNKNOWN];
  return Object.assign({ reason: reason }, base, extra || {});
}

/*
 * 尽力归类安装 / 重启失败原因（接受 electron-updater 错误 / NSIS 退出码）。
 * 优先按消息关键字，其次按退出码；既不命中则归为 UNKNOWN。
 * @param {Error|{message?:string,stack?:string,code?:*,exitCode?:*}} err
 * @returns {string} FailureReason 值
 */
function mapInstallError (err) {
  const msg = String((err && (err.message || err.stack)) || err || '').toLowerCase();
  const code = err && (err.code != null ? err.code : err.exitCode);

  if (/eexist|enospc|space|disk|no space|not enough/.test(msg)) return FailureReason.DISK_SPACE;
  if (/eacces|eperm|permission|denied|write|readonly|read-only/.test(msg)) return FailureReason.NO_WRITE_PERMISSION;
  // 防病毒拦截优先于「文件锁定」（blocked 不应被 locked 误判）
  if (/virus|antivirus|avast|defender|quarantine|blocked|trojan/.test(msg)) return FailureReason.AV_BLOCKED;
  if (/file[\s_-]?in[\s_-]?use|in[\s_-]?use|being used|file locked|locked by|sharing violation/.test(msg)) return FailureReason.FILE_IN_USE;

  // 退出码启发式（Windows 系统错误码）
  if (code === 5 || code === 740) return FailureReason.NO_WRITE_PERMISSION; // ERROR_ACCESS_DENIED / 需提权
  if (code === 32) return FailureReason.FILE_IN_USE;                         // ERROR_SHARING_VIOLATION

  return FailureReason.UNKNOWN;
}

module.exports = { FailureReason, describe, mapInstallError };
