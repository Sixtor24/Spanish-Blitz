import { createHonoServer } from 'react-router-hono-server/node';

const PORT = process.env.PORT || 4000;

console.log(`🚀 Server starting on port ${PORT}...`);

// Import the compiled Hono app from build
import('./build/server/index.js')
  .then(async (module) => {
    const app = module.app || module.default;
    
    if (!app) {
      console.error('❌ App export not found');
      console.error('Available exports:', Object.keys(module));
      process.exit(1);
    }

    console.log('✅ App loaded successfully');

    // Create the server with react-router-hono-server integration
    const server = await createHonoServer({
      app,
      defaultLogger: false,
    });

    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ Failed to start server:', error);
    console.error(error.stack);
    process.exit(1);
  });

