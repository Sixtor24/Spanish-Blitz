import { createHonoServer } from 'react-router-hono-server/node';

const PORT = process.env.PORT || 4000;

console.log(`🚀 Server starting on port ${PORT}...`);

// Import the Hono app with all middleware
import('./__create/index.ts')
  .then(async (module) => {
    const app = module.app || module.default;
    
    if (!app) {
      console.error('❌ App export not found');
      process.exit(1);
    }

    // Create the server with react-router-hono-server integration
    const server = await createHonoServer({
      app,
      defaultLogger: false,
    });

    server.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });

