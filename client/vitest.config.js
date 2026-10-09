import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      reporter: ['html', 'text', 'json-summary'],
      provider: 'v8',
      include: [
        'src/context/**/*.{js,jsx}',
        'src/utils/**/*.{js,jsx}',
        'src/hooks/**/*.{js,jsx}',
        'src/components/{ProductCard,CartItem,ProtectedRoute}.jsx',
      ],
      exclude: [
        'src/main.jsx',
        'src/index.css',
        'src/__tests__/**',
        '**/node_modules/**',
      ],
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
        statements: 70,
      },
    },
  },
});
