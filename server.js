import { serve } from '@hono/node-server';

import('./build/server/index.js')
  .then((build) => {
    const app = build.app || build.default;
    const PORT = process.env.PORT || 4000;

    console.log(`🚀 Server starting on port ${PORT}...`);

    if (!app) {
      console.error('❌ App export not found');
      console.error('Available exports:', Object.keys(build));
      process.exit(1);
    }

    serve({
      fetch: app.fetch,
      port: PORT,
    });

    console.log(`✅ Server running at http://localhost:${PORT}`);
  })
  .catch((error) => {
    console.error('❌ Failed to load server:', error);
    process.exit(1);
  });

