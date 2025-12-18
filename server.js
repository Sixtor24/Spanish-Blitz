import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

const PORT = process.env.PORT || 4000;

console.log(`🚀 Server starting on port ${PORT}...`);

// Import the Hono app and React Router build
Promise.all([
  import('./__create/index.ts'),
  import('./build/server/index.js')
]).then(async ([honoModule, reactRouterModule]) => {
    const honoApp = honoModule.app || honoModule.default;
    const build = reactRouterModule.default || reactRouterModule;
    
    if (!honoApp) {
      console.error('❌ Hono app not found');
      process.exit(1);
    }

    console.log('✅ Hono app loaded');
    console.log('✅ React Router build loaded');

    // Serve static assets
    honoApp.use('/assets/*', serveStatic({ root: './build/client' }));

    // Add React Router SSR handler as catch-all (after API routes)
    honoApp.get('*', async (c) => {
      try {
        // Use React Router's built-in request handler
        const { createRequestHandler } = await import('@react-router/node');
        const handler = createRequestHandler(build, 'production');
        return await handler(c.req.raw);
      } catch (error) {
        console.error('React Router error:', error);
        return c.html('<h1>Internal Server Error</h1><p>' + error.message + '</p>', 500);
      }
    });

    console.log('✅ React Router SSR handler configured');
    console.log('✅ Starting HTTP server...');

    serve({
      fetch: honoApp.fetch,
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

