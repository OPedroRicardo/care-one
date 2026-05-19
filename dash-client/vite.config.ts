import { defineConfig } from 'vite'
import tailwind from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'


// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5174
  },
  plugins: [
    tailwind(),
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
