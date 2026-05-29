import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: isTauri ? "./" : "/dinos-certified-audhd-planner/",
})
