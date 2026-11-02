import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
const {writeSourceIdentity,isSourceInput}=createRequire(import.meta.url)('./scripts/source-identity.cjs');
writeSourceIdentity(process.cwd());

export default defineConfig({
  plugins: [react(),{name:'solarium-source-identity',handleHotUpdate(context){if(isSourceInput(context.file,process.cwd()))writeSourceIdentity(process.cwd());}}],
  clearScreen: false,
  server: { host: '127.0.0.1', port: 1420, strictPort: true, watch:{ignored:['**/output/**','**/.test-dist/**','**/src-tauri/target/**']} },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: { target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13' },
});
