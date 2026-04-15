import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// Multi-page setup:
//   /              → ASCII art p5.js artifact (index.html)
//   /research.html → ResearchOS Vue app
export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        research: resolve(__dirname, 'research.html'),
      },
    },
  },
})
