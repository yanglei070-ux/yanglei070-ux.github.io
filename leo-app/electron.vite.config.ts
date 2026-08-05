import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // 主进程必须打成 CommonJS:Electron 内置的 electron 模块是 CJS,
      // Node 20 的 ESM 加载器对它做命名导入(import { app })时会在预解析阶段崩溃。
      lib: { entry: 'electron/main.ts', formats: ['cjs'] },
      rollupOptions: {
        output: { entryFileNames: 'main.cjs' }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // 同上:preload 也 import electron,必须是 CJS
      lib: { entry: 'electron/preload.ts', formats: ['cjs'] },
      rollupOptions: {
        output: { entryFileNames: 'preload.cjs' }
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'index.html') }
      }
    },
    plugins: [react()]
  }
})
