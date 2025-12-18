import type { Config } from '@react-router/dev/config';

export default {
	appDirectory: './src/app',
	ssr: false,
	prerender: false,
	// Build server bundle for API routes only (not for SSR)
	serverBuildFile: 'index.js',
	serverModuleFormat: 'esm',
} satisfies Config;
