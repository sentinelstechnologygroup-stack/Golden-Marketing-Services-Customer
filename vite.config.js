const portalVersion = String(Date.now());
const portalVersionPlugin = {name:'portal-version',generateBundle(){this.emitFile({type:'asset',fileName:'portal-version.json',source:JSON.stringify({version:portalVersion})});}};
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  define: { __GMS_BUILD_VERSION__: JSON.stringify(portalVersion) },
  plugins: [react(), portalVersionPlugin],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
