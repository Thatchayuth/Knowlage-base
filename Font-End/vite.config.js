import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Unique id per build. Baked into the bundle as __APP_VERSION__ and written to
// dist/version.json, so a running page can tell when a newer build is deployed.
const APP_VERSION = String(Date.now())

function versionFilePlugin() {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION }),
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), versionFilePlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
