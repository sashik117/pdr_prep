import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createRequire } from 'node:module'

const frontendRoot = __dirname
const repoRoot = path.resolve(frontendRoot, '..')
const adminRoot = path.resolve(repoRoot, 'admin/src')
const requireFromFrontend = createRequire(path.join(frontendRoot, 'package.json'))

function adminDependencyResolver() {
  return {
    name: 'admin-dependency-resolver',
    resolveId(source, importer) {
      const normalizedImporter = String(importer || '').replace(/\\/g, '/')
      if (!normalizedImporter.includes('/admin/src/')) {
        return null
      }
      if (source.startsWith('.') || source.startsWith('@/') || source.startsWith('@admin/')) {
        return null
      }
      try {
        return requireFromFrontend.resolve(source)
      } catch {
        return null
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), adminDependencyResolver()],
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
    proxy: {
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
    alias: {
      '@': path.resolve(frontendRoot, './src'),
      '@admin': adminRoot,
      '@tanstack/react-query': path.dirname(requireFromFrontend.resolve('@tanstack/react-query/package.json')),
    },
  },
})
