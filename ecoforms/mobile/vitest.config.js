import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Explicit project root to avoid incorrect resolution in some environments
  root: path.resolve(__dirname),

  test: {
    // Ambiente de testes (happy-dom é mais leve que jsdom)
    environment: 'happy-dom',
    
    // Padrão de arquivos de teste
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    exclude: ['**/node_modules/**', '**/android/**', '**/build/**', '**/.kilo/**'],
    
    // Cobertura de código
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['www/js/core/**/*.js'],
      exclude: [
        '**/*.test.js',
        '**/*.spec.js',
        '**/node_modules/**',
        '**/android/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    },
    
    // Globals
    globals: true,
    
    // Timeout para testes (ms)
    testTimeout: 10000,
    
    // Mock de APIs de navegador
    mockReset: true,
    restoreMocks: true,
    
    // Reporter
    reporters: ['verbose'],
    
    // Setup files
    setupFiles: ['./tests/setup.js']
  },
  
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './www/js/core'),
      '@fields': path.resolve(__dirname, './www/js/fields'),
      '@js': path.resolve(__dirname, './www/js'),
      '@/src': path.resolve(__dirname, '../desktop/src'),
      '@/types': path.resolve(__dirname, '../desktop/types'),
      '@': path.resolve(__dirname, './www'),
      '@desktop': path.resolve(__dirname, '../desktop'),
      // ADR-014 Fase A: /js/ecoforms-core.js (browser path) → core source (vitest)
      '/js/ecoforms-core.js': path.resolve(__dirname, '../packages/core/src/index.ts'),
      'ecoforms-core/sync': path.resolve(__dirname, '../packages/core/src/sync/index.ts'),
      'ecoforms-core/permissions': path.resolve(__dirname, '../packages/core/src/permissions/index.ts'),
      'ecoforms-core/utils': path.resolve(__dirname, '../packages/core/src/utils/index.ts'),
      'ecoforms-core': path.resolve(__dirname, '../packages/core/src/index.ts')
    }
  }
});
