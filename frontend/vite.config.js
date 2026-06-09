import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Default publicDir is frontend/public/ — symlink public/data -> ../../data for local dev.
  // In production, data files are uploaded directly to s3://bucket/data/
  build: {
    outDir: 'dist',
  },
})
