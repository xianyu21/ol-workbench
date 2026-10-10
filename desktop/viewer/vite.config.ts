/// <reference types="node" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 构建产物输出到 desktop/viewer-dist，由桌面端零依赖服务在 /_axviewer 下同源服务
export default defineConfig({
  plugins: [vue()],
  resolve: {
    // 优先解析 .ts/.vue（A 阶段将 UI 层源码迁到 TypeScript；lib/host 仍是 .js 且以显式 .js 后缀引用）
    extensions: ['.ts', '.tsx', '.vue', '.js', '.jsx', '.mjs', '.json'],
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  base: './',
  build: {
    outDir: '../viewer-dist',
    // 沙箱 safe-delete shim 会拦截 vite 清空输出目录；关闭后只写新文件，旧 hash 残留无害
    emptyOutDir: false,
    chunkSizeWarningLimit: 1600,
    // scan-shared.js / user-keys.js 为 CJS 双格式单源模块（Node require + 浏览器内联），
    // 默认 commonjs 处理只覆盖 node_modules，这里把它们也纳入
    commonjsOptions: { include: [/node_modules/, /scan-shared\.js$/, /user-keys\.js$/] },
    rollupOptions: {
      output: {
        // 把体积大头拆成独立 chunk，业务代码改动时命中缓存
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          antdv: ['ant-design-vue']
        }
      }
    }
  }
})
