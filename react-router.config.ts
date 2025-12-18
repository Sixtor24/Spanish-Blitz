import type { Config } from '@react-router/dev/config';
import { vercelPreset } from '@vercel/remix';

export default {
	appDirectory: './src/app',
	ssr: true,
	prerender: false,
	...vercelPreset(),
} satisfies Config;
