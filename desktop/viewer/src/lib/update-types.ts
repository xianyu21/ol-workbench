/*
 * 更新增强 · 纯类型声明（无逻辑）。
 * 失败枚举 / 文案单源在主进程 update/errors.js；此处仅做 TS 类型声明，
 * 渲染层只消费类型与宿主下发的 FailureDescriptor。
 */

export type UpdateChannel = 'stable' | 'beta'

export interface UpdateStatus {
  version: string
  channel: UpdateChannel
  lastKnownGood: string
  portable: boolean
}

/* 更新状态机相位 */
export type UpdatePhase =
  | 'idle'
  | 'downloading'
  | 'ready'
  | 'install-blocked'
  | 'download-failed'
  | 'rolling-back'
  | 'rolled-back'
  | 'rollback-failed'

/* 主进程下发的可读失败描述（title/hint/action/canRetry） */
export interface FailureDescriptor {
  reason: string
  title: string
  hint: string
  action: string
  canRetry: boolean
}

/* update:event 多路复用事件 */
export type UpdateEventType =
  | 'status'
  | 'install-blocked'
  | 'install-failed'
  | 'first-launch-failed'
  | 'download-retry'
  | 'download-exhausted'
  | 'rolled-back'
  | 'rollback-failed'

export interface UpdateEvent {
  type: UpdateEventType
  payload: unknown
}

/* 退避重试状态 */
export interface RetryState {
  attempt: number
  max: number
  nextInMs: number | null
  error: string | null
  exhausted: boolean
}
