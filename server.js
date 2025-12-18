import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createRequestHandler } from 'react-router';

const PORT = process.env.PORT || 4000;

console.log(`🚀 Server starting on port ${PORT}...`);

// Import both the Hono app and the React Router server build
Promise.all([
  import('./build/server/index.js'),
  import('./build/server/assets/server-build.js')
]).then(([honoModule, reactRouterBuild]) => {
    const app = honoModule.app || honoModule.default;
    
    if (!app) {
      console.error('❌ App export not found');
      process.exit(1);
    }

    console.log('✅ Hono app loaded');
    console.log('✅ React Router build loaded');

    // Serve static assets from build/client
    app.use('/assets/*', serveStatic({ root: './build/client' }));
    app.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));

    // Add React Router handler as catch-all (after API routes)
    app.get('*', async (c) => {
      try {
        const requestHandler = createRequestHandler(reactRouterBuild, 'production');
        return await requestHandler(c.req.raw);
      } catch (error) {
        console.error('React Router error:', error);
        return c.text('Internal Server Error', 500);
      }
    });

    console.log('✅ React Router handler registered');
    console.log('✅ Starting HTTP server...');

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

