import { createRequestHandler } from '@react-router/node';
import { installGlobals } from '@react-router/node';
import * as build from './build/server/index.js';

installGlobals();

const PORT = process.env.PORT || 4000;

console.log(`🚀 Server starting on port ${PORT}...`);

const server = build.default;

if (server && typeof server.listen === 'function') {
  server.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
} else {
  console.error('❌ Server export not found or invalid');
  process.exit(1);
}

