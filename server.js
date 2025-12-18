import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createRequestHandler } from '@react-router/node';

const PORT = process.env.PORT || 4000;

console.log(`🚀 Server starting on port ${PORT}...`);

// Import ONLY the compiled build (contains everything: Hono app + React Router)
import('./build/server/index.js')
  .then(async (build) => {
    const app = build.app || build.default;
    
    if (!app) {
      console.error('❌ App not found in build');
      console.error('Available exports:', Object.keys(build));
      process.exit(1);
    }

    console.log('✅ Build loaded successfully');

    // Serve static assets from build/client
    app.use('/assets/*', serveStatic({ root: './build/client' }));

    // Add React Router SSR handler as catch-all (handles all non-API routes)
    app.get('*', async (c) => {
      try {
        const handler = createRequestHandler(build, 'production');
        return await handler(c.req.raw);
      } catch (error) {
        console.error('React Router SSR error:', error);
        return c.html('<h1>500 Internal Server Error</h1><pre>' + error.stack + '</pre>', 500);
      }
    });

    console.log('✅ React Router SSR configured');
    console.log('✅ Starting server...');

    serve({
      fetch: app.fetch,
      port: PORT,
    }, (info) => {
      console.log(`✅ Server running on http://localhost:${info.port}`);
    });
  })
  .catch((error) => {
    console.error('❌ Failed to start server:', error);
    console.error(error.stack);
    process.exit(1);
  });

