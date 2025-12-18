import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

console.log(`🚀 Starting production server on port ${PORT}...`);

// Create a simple Hono app
const app = new Hono();

// Load the compiled Hono app with API routes from the build
const buildPath = join(__dirname, 'build', 'server', 'index.js');

try {
  // Try to load API routes from build if they exist
  const { app: apiApp } = await import(buildPath);
  
  if (apiApp) {
    console.log('✅ API routes loaded from build');
    // Mount API routes
    app.route('/', apiApp);
  }
} catch (error) {
  console.warn('⚠️  Could not load API app from build:', error.message);
  console.log('📝 Server will run without API routes');
}

// Serve static assets
console.log('✅ Configuring static file serving...');
app.use('/assets/*', serveStatic({ root: './build/client' }));
app.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));

// Load and serve index.html for all non-API routes
const indexHtmlPath = join(__dirname, 'build', 'client', 'index.html');
const indexHtml = readFileSync(indexHtmlPath, 'utf-8');

app.get('*', (c) => {
  // Only serve HTML for non-API routes
  if (!c.req.path.startsWith('/api/')) {
    return c.html(indexHtml);
  }
  return c.json({ error: 'Not found' }, 404);
});

console.log('✅ SPA routing configured');
console.log('✅ Starting HTTP server...');

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`✅ Server running on http://localhost:${info.port}`);
  console.log(`📁 Serving static files from: build/client`);
  console.log(`🌐 SPA mode enabled`);
});

