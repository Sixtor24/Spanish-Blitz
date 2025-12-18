import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFileSync } from 'node:fs';

const PORT = process.env.PORT || 4000;

console.log(`🚀 Server starting on port ${PORT}...`);

// Import the compiled Hono app with API routes and middleware
import('./build/server/index.js')
  .then((build) => {
    const app = build.app || build.default;
    
    if (!app) {
      console.error('❌ App not found in build');
      console.error('Available exports:', Object.keys(build));
      process.exit(1);
    }

    console.log('✅ Hono app loaded (API routes + middleware)');

    // Serve static assets from build/client
    app.use('/assets/*', serveStatic({ root: './build/client' }));
    app.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));

    // Serve index.html for all non-API routes (SPA fallback)
    const indexHtml = readFileSync('./build/client/index.html', 'utf-8');
    
    app.get('*', (c) => {
      // Only serve HTML for non-API routes
      if (!c.req.path.startsWith('/api/')) {
        return c.html(indexHtml);
      }
      return c.notFound();
    });

    console.log('✅ Client-side routing configured (SPA mode)');
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

