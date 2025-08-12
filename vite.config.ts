import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/skyjo-app/' // <- hier deinen Repo-Namen eintragen!
})
