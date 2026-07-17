import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom gives React Testing Library a browser-like DOM in Vitest.
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: true,
  },
});
