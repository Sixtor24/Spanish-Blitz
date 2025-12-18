import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFileSync } from 'node:fs';

const PORT = process.env.PORT || 4000;

console.log(`🚀 Starting server on port ${PORT}...`);

// Dynamic import with proper error handling
let honoApp;
try {
  // Try to import the compiled __create module
  const createModule = await import('./__create/index.ts');
  honoApp = createModule.app || createModule.default;
  console.log('✅ API app loaded from __create/index.ts');
} catch (error) {
  console.error('❌ Failed to load API app:', error.message);
  
  // Fallback: create minimal Hono app
  const { Hono } = await import('hono');
  honoApp = new Hono();
  honoApp.get('/api/*', (c) => c.json({ error: 'API not available' }, 503));
  console.log('⚠️  Running with minimal fallback server');
}

// Serve static assets
honoApp.use('/assets/*', serveStatic({ root: './build/client' }));
honoApp.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));

// Load and serve index.html for all non-API routes (SPA)
const indexHtml = readFileSync('./build/client/index.html', 'utf-8');

honoApp.get('*', (c) => {
  // Only serve HTML for non-API routes
  if (!c.req.path.startsWith('/api/')) {
    return c.html(indexHtml);
  }
  return c.json({ error: 'Not found' }, 404);
});

console.log('✅ Static file serving configured');
console.log('✅ SPA routing configured');
console.log('✅ Starting HTTP server...');

serve({
  fetch: honoApp.fetch,
  port: PORT,
}, (info) => {
  console.log(`✅ Server running on http://localhost:${info.port}`);
  console.log(`📁 Serving from: build/client`);
  console.log(`🌐 API routes: /api/*`);
  console.log(`🌐 SPA mode enabled for other routes`);
});

