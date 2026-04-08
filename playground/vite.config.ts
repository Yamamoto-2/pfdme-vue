import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'pdfme-vue': resolve(__dirname, '../src/index.ts'),
    },
    // Allow resolving from parent node_modules for shared deps
    dedupe: ['vue', '@pdfme/common', '@pdfme/schemas', 'ant-design-vue'],
  },
  // Also search parent node_modules
  server: {
    fs: {
      allow: [resolve(__dirname, '..')],
    },
  },
});
