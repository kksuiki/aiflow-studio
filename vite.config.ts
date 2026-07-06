import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'
import { visualizer } from 'rollup-plugin-visualizer'
import { chunkBudgetPlugin } from './build/chunkBudgetPlugin'

export default defineConfig(({ mode }) => {
  const isAnalyze = mode === 'analyze'

  return {
    plugins: [
      react(),
      viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 10240,
        deleteOriginFile: false,
      }),
      viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 10240,
        deleteOriginFile: false,
      }),
      chunkBudgetPlugin({
        entryChunkLimitKB: 350,
        chunkLimitKB: 500,
        assetLimitKB: 300,
        failOnError: false,
      }),
      ...(isAnalyze
        ? [
            visualizer({
              filename: 'dist/bundle-analysis.html',
              template: 'treemap',
              gzipSize: true,
              brotliSize: true,
              open: false,
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': '/src',
        '@components': '/src/components',
        '@pages': '/src/pages',
        '@store': '/src/store',
        '@hooks': '/src/hooks',
        '@utils': '/src/utils',
        '@types': '/src/types',
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-antd': ['antd', '@ant-design/icons'],
            'vendor-flow': ['@xyflow/react'],
          },
        },
      },
    },
  }
})
