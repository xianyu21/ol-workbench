/// <reference types="vite/client" />

/* 全局类型补丁：Vue SFC 与宿主桥注入 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare global {
  interface Window {
    /* 宿主桥（由桌面端 preload 注入，headless 时由测试桩注入）；业务层仅在 host/index.js 经此取桥 */
    axhub?: unknown
  }
}

export {}
