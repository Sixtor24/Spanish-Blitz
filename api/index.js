// Vercel serverless function entry point for Hono server
import { handle } from 'hono/vercel';
import { app } from '../build/server/index.js';

export default handle(app);

