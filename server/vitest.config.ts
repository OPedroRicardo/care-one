import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@api-service': path.resolve(__dirname, './api-service'),
      '@mqtt-service': path.resolve(__dirname, './mqtt-service'),
      '@shared':       path.resolve(__dirname, './shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // forks garante processo isolado por arquivo → banco :memory: separado por suite
    pool: 'forks',
    setupFiles: ['./api-service/__tests__/setup.ts'],
  },
})
