import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 构建产物输出到 desktop/viewer-dist，由 axhub-server.js 在 /_axviewer 下同源服务
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: '../viewer-dist',
    // 沙箱 safe-delete shim 会拦截 vite 清空输出目录；关闭后只写新文件，旧 hash 残留无害
    emptyOutDir: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // 把体积大头 ant-design-vue / vue 拆成独立 chunk，业务代码改动时命中缓存
        manualChunks: {
          vendor: ['vue'],
          antdv: ['ant-design-vue']
        }
      }
    }
  }
})
