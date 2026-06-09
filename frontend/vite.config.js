import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // data/ dir at project root is served as /data in dev via publicDir override
  publicDir: '../data',
  build: {
    outDir: 'dist',
  },
})
