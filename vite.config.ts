import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts', 'pipeline/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
