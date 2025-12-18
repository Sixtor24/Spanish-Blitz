import type { Config } from '@react-router/dev/config';
import { vercelPreset } from '@vercel/react-router/vite';

export default {
	appDirectory: './src/app',
	ssr: true,
	prerender: false,
	...vercelPreset(),
} satisfies Config;
