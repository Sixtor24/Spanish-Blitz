import { serve } from '@hono/node-server';

const PORT = process.env.PORT || 4000;

console.log(`🚀 Server starting on port ${PORT}...`);

// Import the compiled server from build (already has React Router integrated)
import('./build/server/index.js')
  .then((module) => {
    const app = module.app || module.default;
    
    if (!app) {
      console.error('❌ App export not found');
      console.error('Available exports:', Object.keys(module));
      process.exit(1);
    }

    console.log('✅ App loaded successfully');
    console.log('✅ Starting HTTP server...');

    // Serve the Hono app (already has React Router routes integrated by build)
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

