import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

const PORT = process.env.PORT || 4000;

console.log(`🚀 Server starting on port ${PORT}...`);

// Import the compiled Hono app
import('./build/server/index.js')
  .then((module) => {
    const app = module.app || module.default;
    
    if (!app) {
      console.error('❌ App export not found');
      console.error('Available exports:', Object.keys(module));
      process.exit(1);
    }

    console.log('✅ Hono app loaded');

    // Serve static assets from build/client
    app.use('/assets/*', serveStatic({ root: './build/client' }));
    app.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));
    
    // Serve all static files from build/client
    app.use('*', serveStatic({ root: './build/client' }));

    console.log('✅ Static file serving configured');
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

