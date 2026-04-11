import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'https://arcane-labs-code-for-change2-0.onrender.com'  //change this during production to the actual backend url
    }
  },
})
