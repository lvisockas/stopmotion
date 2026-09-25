import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // relative asset URLs: the build works from any sub-path (GitHub Pages)
  base: './',
  plugins: [react()],
  build: { target: 'es2022' },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
