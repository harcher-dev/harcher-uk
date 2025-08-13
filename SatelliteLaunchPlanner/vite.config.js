import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// NOTE: set `base` to '/REPO_NAME/' if you will deploy to a repo page (https://username.github.io/REPO_NAME/)
// keep '/' for a user/organization page (https://username.github.io/)
export default defineConfig({
  base: '/satellite-launch-planner/',
  plugins: [react()]
})
