import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	build: {
		target: ['chrome111', 'edge111', 'firefox113', 'safari16.4'],
		cssTarget: ['chrome111', 'edge111', 'firefox113', 'safari16.4']
	},
	test: {
		include: ['tests/**/*.{test,spec}.{js,mjs,ts}'],
		exclude: ['tests/e2e/**'],
		globals: true,
		environment: 'jsdom',
		setupFiles: ['tests/test-setup.ts'],
		maxWorkers: process.env.CI ? 2 : 6
	}
});
