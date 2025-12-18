import { handle } from 'hono/vercel';
import server, { app } from '../__create';

export const config = {
  runtime: 'nodejs20.x',
};

// Use the Hono app when running in Vercel serverless
export default handle(app ?? server);
