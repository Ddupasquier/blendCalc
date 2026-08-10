import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import {
	createConnectSources,
	createImageSources
} from './config/contentSecurityPolicy.js';

const packageMetadata = JSON.parse(
	readFileSync(new URL('./package.json', import.meta.url), 'utf8')
);
const deploymentReference = (
	process.env.VERCEL_GIT_COMMIT_SHA ??
	process.env.GITHUB_SHA ??
	'local'
).slice(0, 12);
const buildVersion = `${packageMetadata.version}+${deploymentReference}`;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		version: {
			name: buildVersion
		},
		adapter: adapter({
			external: ['ws']
		}),
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'base-uri': ['self'],
				'connect-src': createConnectSources(),
				'font-src': ['self', 'data:'],
				'form-action': ['self'],
				'frame-ancestors': ['none'],
				'img-src': createImageSources(),
				'object-src': ['none'],
				'script-src': ['self', 'wasm-unsafe-eval', 'https://cdn.jsdelivr.net'],
				'worker-src': ['self', 'blob:', 'https://cdn.jsdelivr.net'],
				'style-src': ['self', 'unsafe-inline']
			}
		}
	}
};

export default config;
