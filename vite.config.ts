import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [svelte()],
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts', 'pipeline/**/*.test.ts'] },
});
