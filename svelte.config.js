import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			external: ['ws']
		}),
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'base-uri': ['self'],
				'connect-src': [
					'self',
					'https://api.nal.usda.gov',
					'https://world.openfoodfacts.org',
					'https://cdn.jsdelivr.net',
					'https://*.supabase.co',
					'wss://*.supabase.co',
					'https://vitals.vercel-insights.com'
				],
				'font-src': ['self', 'data:'],
				'form-action': ['self'],
				'frame-ancestors': ['none'],
				'img-src': ['self', 'data:', 'https:'],
				'object-src': ['none'],
				'script-src': ['self', 'wasm-unsafe-eval', 'https://cdn.jsdelivr.net'],
				'worker-src': ['self', 'blob:', 'https://cdn.jsdelivr.net'],
				'style-src': ['self', 'unsafe-inline']
			}
		}
	}
};

export default config;
