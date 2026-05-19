import { defineConfig } from 'vite'
import tailwind from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'


// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwind(),
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    port: 5175,
    proxy: {
      '/totem': 'http://localhost:3333',
    },
  },
})
